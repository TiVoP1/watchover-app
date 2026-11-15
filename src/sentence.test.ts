import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { businessSentence } from '#web/business/sentence.ts'
import { radarFrame } from '#web/map/drawn.ts'
import { playFrame } from '#web/map/play-frames.ts'
import { composeSentence } from '#web/sentence.ts'
import { useStore } from '#web/state/store.ts'
import { backgroundFrame, type Chapter, itemById } from '#web/story/chapters.ts'
import { formatDateTime } from '#web/ui/format.ts'

const files = import.meta.glob<unknown>(
  ['/public/data/stalowa-wola/**/*.json', '/public/data/mexico-city/*.json'],
  { eager: true, import: 'default' },
)

const ZONE = 'Europe/Warsaw'
const initial = useStore.getState()

function serve(url: string): Promise<Response> {
  const body = files[`/public${url}`]
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  )
}

const state = () => useStore.getState()

function drawnFrame(): number | null {
  const s = state()
  if (s.place.status !== 'ready') return null
  const { data, story } = s.place
  const item = s.item === null ? null : itemById(story, s.item)
  const business = s.mode === 'business'
  if ((s.playing || s.paused) && !business && item === null) {
    return playFrame(story, data.radar?.frames ?? [], s.frame)
  }
  return radarFrame({ data, story, frame: s.frame, item, business })
}

const sentence = (drawn = drawnFrame()) => composeSentence(state(), ZONE, drawn)
const text = () => sentence()?.text?.replaceAll(' ', ' ') ?? null
const words = () => (text() ?? '').split(/\s+/).filter(Boolean).length

function chapter(n: number): Chapter {
  const place = state().place
  const found = place.status === 'ready' ? place.story.chapters.find((c) => c.n === n) : undefined
  if (found === undefined) throw new Error(`chapter ${String(n)}`)
  return found
}

beforeAll(() => {
  vi.stubGlobal('fetch', serve)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  useStore.setState(initial, true)
  await state().open('stalowa-wola')
})

describe('composeSentence', () => {
  it('states the goal on the globe, with no date', () => {
    expect(sentence()).toEqual({
      when: null,
      kind: null,
      text: 'Keep an eye on the places you love.',
    })
  })

  it('asks for a click on Stalowa Wola once the globe idles, whichever place is loaded', async () => {
    state().setNudge(true)
    expect(sentence()).toEqual({ when: null, kind: null, text: 'Click Stalowa Wola to start.' })
    await state().open('mexico-city')
    expect(text()).toBe('Click Stalowa Wola to start.')
  })

  it('keeps the place sentence once off the globe', () => {
    state().setNudge(true)
    state().enter()
    expect(text()).toBe('This year at Stalowa Wola: 5 changes seen by radar.')
  })

  it('counts the changes at rest, under the local date and time of the resting pass', () => {
    state().enter()
    expect(text()).toBe('This year at Stalowa Wola: 5 changes seen by radar.')
    expect(sentence()?.when).toBe('26 Oct 2026, 04:13')
  })

  it('says All quiet on quiet passes, then tells the data gap and each Play stop', () => {
    state().enter()
    state().setPlaying(true)
    expect(text()).toBe('All quiet.')
    expect(sentence()?.kind).toBeNull()
    expect(sentence()?.when).not.toBeNull()
    state().playAt({ frame: 11, chapter: null, gap: true })
    expect(text()).toBe('No public NISAR data from 19 Jan to 16 Jun 2026.')
    state().playAt({ frame: chapter(2).frame, chapter: 2, gap: false })
    expect(sentence()?.kind).toBe('forest')
    expect(text()).toBe('Trees stopped bouncing the radar back here: 4.1 ha gone.')
    state().setPlaying(false)
    expect(text()).toBe('Trees stopped bouncing the radar back here: 4.1 ha gone.')
    expect(sentence()?.when).toBe('10 Aug 2026, 05:21')
  })

  it('says All quiet on a quiet Play step, even on a pass that More changes dates', () => {
    state().enter()
    state().setPlaying(true)
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    const [secondary] = place.story.secondary
    if (secondary === undefined) throw new Error('secondary')
    state().playAt({ frame: secondary.frame, chapter: null, gap: false })
    expect(sentence()?.text).toBe('All quiet.')
    expect(sentence()?.kind).toBeNull()
  })

  it('dates the quiet passes after a stop by the pass drawn, while the stop stays open', () => {
    state().enter()
    state().setPlaying(true)
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    const frames = place.data.radar?.frames ?? []
    const frost = chapter(1)
    state().playAt({ frame: frost.frame + 1, chapter: 1, gap: false })
    expect(state().chapter).toBe(1)
    expect(text()).toBe('All quiet.')
    expect(sentence()?.kind).toBeNull()
    expect(sentence()?.when).toBe(formatDateTime(frames[frost.frame + 1]?.time ?? '', ZONE))
  })

  it('keeps a stop sentence while its own pass is still the one drawn', () => {
    state().enter()
    state().setPlaying(true)
    const building = chapter(6)
    state().playAt({ frame: building.frame + 1, chapter: 6, gap: false })
    expect(text()).toBe('Warm days move this building 4 to 5 mm.')
    expect(sentence()?.when).toBe(formatDateTime(building.time, ZONE))
  })

  it('dates the row by the image the map has drawn while the next one loads', () => {
    state().enter()
    state().setPlaying(true)
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    const frames = place.data.radar?.frames ?? []
    state().playAt({ frame: 6, chapter: null, gap: false })
    expect(sentence(2)?.when).toBe(formatDateTime(frames[2]?.time ?? '', ZONE))
    expect(sentence(null)?.when).toBeNull()
  })

  it('dates a quiet Play step by the background pass the map draws, not the head', () => {
    state().enter()
    state().setPlaying(true)
    const place = state().place
    if (place.status !== 'ready' || place.story.gap === null) throw new Error('gap')
    const frames = place.data.radar?.frames ?? []
    const head = place.story.gap.firstAfter
    const drawn = backgroundFrame(frames, place.story.background, head)
    state().playAt({ frame: head, chapter: null, gap: false })
    expect(drawn).not.toBe(head)
    expect(sentence()?.when).toBe(formatDateTime(frames[drawn]?.time ?? '', ZONE))
    expect(sentence()?.when).not.toBe(formatDateTime(frames[head]?.time ?? '', ZONE))
  })

  it('tells the open Card, the recap and the clicks on the map', () => {
    state().enter()
    state().openItem(chapter(5).id)
    expect(sentence()?.kind).toBe('rework')
    expect(text()).toBe('2.2 ha of ground here stopped matching its usual radar pattern.')
    state().finishPlay()
    expect(state().panel).toBe('recap')
    expect(text()).toBe('This year at Stalowa Wola: 5 changes seen by radar.')
    state().setNotice('quiet')
    expect(text()).toBe('No change kept here this year. The radar looked 52 times.')
    state().setNotice('fog')
    expect(text()).toBe('Not analysed yet. NISAR passes here too.')
    state().setNotice('unanalysed')
    expect(text()).toBe('Not analysed for changes yet.')
  })

  it('names the open tool and hands Business to its own sentence', () => {
    state().enter()
    state().setTool('sharpen')
    expect(text()).toBe('17 visits laid on top of each other: the grain fades.')
    expect(sentence()?.when).toBeNull()
    state().openItem(chapter(3).id)
    state().setTool('clouds')
    expect(text()).toBe('Left: an ordinary satellite photo that day, 68% cloud (estimated).')
    state().setMode('business')
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    const expected = businessSentence({
      data: place.data,
      frame: state().frame,
      playing: false,
      timeZone: ZONE,
    })
    expect(sentence()?.text).toBe(expected)
    state().setPlaying(true)
    expect(sentence()?.text).toMatch(/at the evening pass$/)
    expect(sentence()?.when).toBeNull()
  })

  it('keeps the evening pass of a paused Business Play, never the backdrop date', () => {
    state().setMode('business')
    state().setPlaying(true)
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    const frames = place.data.radar?.frames ?? []
    const warmest = frames.findIndex((f) => f.time === '2026-07-16T17:43:20Z')
    state().playAt({ frame: warmest, chapter: null, gap: false })
    state().setPlaying(false)
    expect(text()).toBe('16 Jul, 26.9 °C at the evening pass')
    expect(sentence()?.when).toBeNull()
  })

  it('drops the backdrop date where Business has no building series', async () => {
    await state().open('mexico-city')
    state().setMode('business')
    expect(text()).toMatch(/^Nezahualcóyotl moved/)
    expect(sentence()?.when).toBeNull()
  })

  it('keeps the people sentences within twelve words', () => {
    state().enter()
    expect(words()).toBeLessThanOrEqual(12)
    state().setPlaying(true)
    state().playAt({ frame: chapter(3).frame, chapter: 3, gap: false })
    expect(words()).toBeLessThanOrEqual(12)
    state().playAt({ frame: chapter(6).frame, chapter: 6, gap: false })
    expect(text()).toBe('Warm days move this building 4 to 5 mm.')
    for (const n of [1, 2, 3, 4, 5]) {
      state().playAt({ frame: chapter(n).frame, chapter: n, gap: false })
      expect(words()).toBeLessThanOrEqual(12)
    }
    state().finishPlay()
    expect(words()).toBeLessThanOrEqual(12)
  })

  it('tells the summary of another place in at most 12 words', async () => {
    await state().open('mexico-city')
    state().enter()
    expect(text()).toMatch(/^Nezahualcóyotl moved \S+ cm away from the radar/)
    expect(words()).toBeLessThanOrEqual(12)
  })
})
