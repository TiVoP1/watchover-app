import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { selectChapter, selectItem, selectZone, useStore } from '#web/state/store.ts'

const files = import.meta.glob<unknown>(
  ['/public/data/stalowa-wola/**/*.json', '/public/data/mexico-city/*.json'],
  { eager: true, import: 'default' },
)

const initial = useStore.getState()

function serve(url: string): Promise<Response> {
  const body = files[`/public${url}`]
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  )
}

const state = () => useStore.getState()

function story() {
  const place = state().place
  if (place.status !== 'ready') throw new Error('place not ready')
  return place.story
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

describe('opening a place', () => {
  it('waits on the globe at the resting frame and never plays there', () => {
    expect(state().panel).toBe('orbit')
    expect(state().frame).toBe(story().restFrame)
    state().setPlaying(true)
    expect(state().playing).toBe(false)
  })

  it('lands on the place only when asked', () => {
    state().enter()
    expect(state().panel).toBe('rest')
  })

  it('reads the zone of the place being opened', () => {
    expect(selectZone(state())).toBe('Europe/Warsaw')
    void state().open('mexico-city')
    expect(selectZone(state())).toBe('America/Mexico_City')
  })
})

describe('Play the year', () => {
  beforeEach(() => {
    state().enter()
  })

  it('always starts from the first pass', () => {
    state().setFrame(30)
    state().setPlaying(true)
    expect(state().playing).toBe(true)
    expect(state().frame).toBe(0)
  })

  it('resumes after a pause, and rewinds after anything else', () => {
    state().setPlaying(true)
    state().playAt({ frame: 10, chapter: null, gap: false })
    state().setPlaying(false)
    expect(state().paused).toBe(true)
    state().setPlaying(true)
    expect(state().frame).toBe(10)
    state().setPlaying(false)
    state().setFrame(12)
    state().setPlaying(true)
    expect(state().frame).toBe(0)
  })

  it('moves only while playing and ends in the recap', () => {
    state().playAt({ frame: 5, chapter: null, gap: false })
    expect(state().frame).not.toBe(5)
    state().setPlaying(true)
    const forest = story().chapters[1]
    if (forest === undefined) throw new Error('forest')
    state().playAt({ frame: forest.frame, chapter: forest.n, gap: false })
    expect(selectChapter(state())).toBe(forest)
    state().finishPlay()
    expect(state().panel).toBe('recap')
    expect(state().playing).toBe(false)
    expect(state().chapter).toBeNull()
  })

  it('starts Business at the first evening pass', () => {
    state().setMode('business')
    state().setPlaying(true)
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    expect(place.data.radar?.frames[state().frame]?.time).toBe('2026-06-22T17:43:22Z')
    state().finishPlay()
    expect(state().panel).toBe('rest')
  })

  it('freezes a chapter stop for the film and resumes from it', () => {
    state().freezeChapter(2)
    const forest = story().chapters[1]
    expect(state().frame).toBe(forest?.frame)
    expect(state().chapter).toBe(2)
    expect(state().paused).toBe(true)
    state().setPlaying(true)
    expect(state().frame).toBe(forest?.frame)
  })
})

describe('a Card opened during Play', () => {
  beforeEach(() => {
    state().enter()
  })

  function stopAt(n: number) {
    const chapter = story().chapters[n - 1]
    if (chapter === undefined) throw new Error(`chapter ${String(n)}`)
    state().playAt({ frame: chapter.frame, chapter: chapter.n, gap: false })
    return chapter
  }

  it('resumes from the stop the Card was opened at', () => {
    state().setPlaying(true)
    const forest = stopAt(2)
    state().openItem(forest.id)
    expect(state().panel).toBe('story')
    expect(state().playing).toBe(false)
    state().setPlaying(true)
    expect(state().playing).toBe(true)
    expect(state().panel).toBe('rest')
    expect(state().item).toBeNull()
    expect(state().frame).toBe(forest.frame)
    expect(state().chapter).toBe(forest.n)
  })

  it('keeps the stop while other Cards are opened and goes back to it', () => {
    state().setPlaying(true)
    const stop = stopAt(3)
    const [first, second] = story().chapters
    if (first === undefined || second === undefined) throw new Error('chapters')
    state().openItem(first.id)
    state().openItem(second.id)
    expect(state().frame).toBe(second.frame)
    state().openItem(null)
    expect(state().panel).toBe('rest')
    expect(state().paused).toBe(true)
    expect(state().frame).toBe(stop.frame)
    expect(state().chapter).toBe(stop.n)
    state().openItem(first.id)
    state().back()
    expect(state().paused).toBe(true)
    expect(state().chapter).toBe(stop.n)
    state().setPlaying(true)
    expect(state().frame).toBe(stop.frame)
  })

  it('keeps the stop when a paused Play is opened from a pin', () => {
    state().setPlaying(true)
    const stop = stopAt(4)
    state().setPlaying(false)
    const [first] = story().chapters
    state().openItem(first?.id ?? null)
    state().setPlaying(true)
    expect(state().frame).toBe(stop.frame)
    expect(state().chapter).toBe(stop.n)
  })

  it('plays from the first pass after a Card opened outside Play', () => {
    const fields = story().chapters[3]
    state().openItem(fields?.id ?? null)
    expect(state().resumeAt).toBeNull()
    state().setPlaying(true)
    expect(state().frame).toBe(0)
    expect(state().panel).toBe('rest')
  })

  it('forgets the stop once the timeline is moved by hand', () => {
    state().setPlaying(true)
    const forest = stopAt(2)
    state().openItem(forest.id)
    state().setFrame(30)
    expect(state().resumeAt).toBeNull()
    state().setPlaying(true)
    expect(state().frame).toBe(0)
  })
})

describe('cards and going back', () => {
  beforeEach(() => {
    state().enter()
  })

  it('opens a change on its own pass and closes it again', () => {
    const fields = story().chapters[3]
    if (fields === undefined) throw new Error('fields')
    state().openItem(fields.id)
    expect(state().panel).toBe('story')
    expect(state().frame).toBe(fields.frame)
    expect(selectItem(state())).toBe(fields)
    state().openItem(null)
    expect(state().panel).toBe('rest')
    expect(state().item).toBeNull()
  })

  it('steps back one level at a time down to the globe', () => {
    const fields = story().chapters[3]
    if (fields === undefined) throw new Error('fields')
    state().openItem(fields.id)
    state().setTool('clouds')
    state().back()
    expect(state().tool).toBe('none')
    expect(state().panel).toBe('story')
    state().back()
    expect(state().panel).toBe('rest')
    state().back()
    expect(state().panel).toBe('orbit')
  })

  it('closes the card when the timeline is moved by hand', () => {
    const fields = story().chapters[3]
    if (fields === undefined) throw new Error('fields')
    state().openItem(fields.id)
    state().setFrame(2)
    expect(state().panel).toBe('rest')
    expect(state().frame).toBe(2)
  })

  it('shows a map notice until the next step, never during Play', () => {
    state().setNotice('fog')
    expect(state().notice).toBe('fog')
    state().back()
    expect(state().notice).toBeNull()
    expect(state().panel).toBe('rest')
    state().setPlaying(true)
    state().setNotice('quiet')
    expect(state().notice).toBeNull()
  })

  it('lands from the globe when Business or a tool is chosen there', () => {
    state().back()
    expect(state().panel).toBe('orbit')
    state().setMode('business')
    expect(state().panel).toBe('rest')
    state().back()
    state().setTool('sharpen')
    expect(state().panel).toBe('rest')
    expect(state().tool).toBe('sharpen')
  })
})
