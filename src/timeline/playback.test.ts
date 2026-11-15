import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type StoreState, useStore } from '#web/state/store.ts'
import { displayFrame, playStartFrame } from '#web/story/chapters.ts'
import {
  followPlayback,
  playSchedule,
  runSteps,
  stepIndex,
  type TimedStep,
} from '#web/timeline/playback.ts'
import { MOTION } from '#web/tokens.ts'

const files = import.meta.glob<unknown>('/public/data/stalowa-wola/**/*.json', {
  eager: true,
  import: 'default',
})

const initial = useStore.getState()
const state = () => useStore.getState()

function serve(url: string): Promise<Response> {
  const body = files[`/public${url}`]
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  )
}

function ready() {
  const place = state().place
  if (place.status !== 'ready') throw new Error('place not ready')
  return { ...place, frames: place.data.radar?.frames ?? [] }
}

const totalMs = (steps: readonly TimedStep[]) => steps.reduce((sum, s) => sum + s.holdMs, 0)

const sentenceOf = (s: StoreState): string => {
  if (s.panel === 'recap') return 'recap'
  if (!s.playing && !s.paused) return 'rest'
  if (s.gap) return 'gap'
  return s.chapter === null ? 'quiet' : `chapter ${String(s.chapter)}`
}

function peopleSchedule() {
  const { data, story, frames } = ready()
  return playSchedule(story, frames.length, 'people', playStartFrame(data, 'people'))
}

let stopPlayback: (() => void) | null = null

beforeAll(() => {
  vi.stubGlobal('fetch', serve)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  useStore.setState(initial, true)
  await state().open('stalowa-wola')
  state().enter()
})

afterEach(() => {
  stopPlayback?.()
  stopPlayback = null
  vi.useRealTimers()
})

describe('playSchedule', () => {
  it('visits every pass once from 19 Oct 2025 and stops at the six chapters and the gap', () => {
    const { story, frames } = ready()
    const steps = peopleSchedule()
    expect(frames[steps[0]?.frame ?? -1]?.time).toBe('2025-10-19T03:13:36Z')
    expect(new Set(steps.map((s) => s.frame)).size).toBe(frames.length)
    const stops = steps.filter((s) => s.holdMs === MOTION.changePassMs)
    expect(stops.map((s) => s.frame)).toEqual(story.chapters.map((c) => c.frame))
    expect(stops.map((s) => s.chapter)).toEqual([1, 2, 3, 4, 5, 6])
    expect(steps.filter((s) => s.gap)).toEqual([
      { frame: story.gap?.lastBefore, chapter: null, gap: true, holdMs: MOTION.gapHoldMs },
    ])
    expect(steps.filter((s) => s.holdMs === MOTION.quietPassMs)).toHaveLength(46)
  })

  it('lasts between 24 and 28 s', () => {
    const ms = totalMs(peopleSchedule())
    expect(ms).toBe(46 * MOTION.quietPassMs + 6 * MOTION.changePassMs + MOTION.gapHoldMs)
    expect(ms).toBeGreaterThanOrEqual(24_000)
    expect(ms).toBeLessThanOrEqual(28_000)
  })

  it('draws only the background track between stops, so only real change moves', () => {
    const { story, frames } = ready()
    const quiet = peopleSchedule().filter((s) => s.holdMs !== MOTION.changePassMs)
    const drawn = quiet.map((s) => displayFrame(story, frames, s.frame, null))
    expect(new Set(drawn.map((i) => frames[i]?.track))).toEqual(new Set([28]))
    expect(new Set(drawn).size).toBe(17)
  })

  it('keeps each stop open in the inset until the next stop or the gap', () => {
    const said = peopleSchedule().map((s) =>
      s.gap ? 'gap' : s.chapter === null ? 'quiet' : `chapter ${String(s.chapter)}`,
    )
    const changes = said.filter((now, i) => i > 0 && now !== said[i - 1])
    expect(changes).toEqual([
      'chapter 1',
      'gap',
      'quiet',
      'chapter 2',
      'chapter 3',
      'chapter 4',
      'chapter 5',
      'chapter 6',
    ])
  })

  it('plays Business from the first evening pass without stops', () => {
    const { data, story, frames } = ready()
    const steps = playSchedule(story, frames.length, 'business', playStartFrame(data, 'business'))
    expect(frames[steps[0]?.frame ?? -1]?.time).toBe('2026-06-22T17:43:22Z')
    expect(steps.every((s) => s.chapter === null && !s.gap)).toBe(true)
    expect(steps.every((s) => s.holdMs === MOTION.quietPassMs)).toBe(true)
    expect(steps.at(-1)?.frame).toBe(frames.length - 1)
  })
})

describe('stepIndex and runSteps', () => {
  it('finds the step to resume, telling the gap hold from the pass before it', () => {
    const steps = peopleSchedule()
    const gap = ready().story.gap?.lastBefore ?? -1
    expect(steps[stepIndex(steps, gap, false)]).toMatchObject({ frame: gap, gap: false })
    expect(steps[stepIndex(steps, gap, true)]).toMatchObject({ frame: gap, gap: true })
  })

  it('shows each step for its hold and then ends', () => {
    vi.useFakeTimers()
    const steps: TimedStep[] = [
      { frame: 0, chapter: null, gap: false, holdMs: 150 },
      { frame: 1, chapter: 1, gap: false, holdMs: 3000 },
    ]
    const seen: string[] = []
    runSteps(
      steps,
      0,
      (s) => seen.push(`frame ${String(s.frame)}`),
      () => seen.push('end'),
    )
    expect(seen).toEqual(['frame 0'])
    vi.advanceTimersByTime(150)
    expect(seen).toEqual(['frame 0', 'frame 1'])
    vi.advanceTimersByTime(2999)
    expect(seen).toEqual(['frame 0', 'frame 1'])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual(['frame 0', 'frame 1', 'end'])
  })
})

describe('Play the year on fake timers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stopPlayback = followPlayback()
  })

  it('starts at 19 Oct 2025 from anywhere, lasts 24 to 28 s and ends in the recap', () => {
    const { frames, story } = ready()
    const second = story.chapters[1]
    if (second === undefined) throw new Error('chapter 2')
    state().openItem(second.id)
    const said: string[] = []
    const endedAt: number[] = []
    const unsubscribe = useStore.subscribe((s) => {
      const now = sentenceOf(s)
      if (said.at(-1) === now) return
      said.push(now)
      if (now === 'recap') endedAt.push(Date.now())
    })
    const startedAt = Date.now()
    state().setPlaying(true)
    expect(frames[state().frame]?.time).toBe('2025-10-19T03:13:36Z')
    expect(state().panel).toBe('rest')
    vi.advanceTimersByTime(23_999)
    expect(state().playing).toBe(true)
    vi.advanceTimersByTime(4_001)
    unsubscribe()
    expect(state().panel).toBe('recap')
    expect(state().playing).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(endedAt).toEqual([startedAt + totalMs(peopleSchedule())])
    expect(said.length - 1).toBeLessThanOrEqual(9)
    expect(said).toEqual([
      'quiet',
      'chapter 1',
      'gap',
      'quiet',
      'chapter 2',
      'chapter 3',
      'chapter 4',
      'chapter 5',
      'chapter 6',
      'recap',
    ])
  })

  it('holds each chapter 3 s on its own pass and the gap 1.2 s', () => {
    const { story } = ready()
    const first = story.chapters[0]
    const gap = story.gap
    if (first === undefined || gap === null) throw new Error('story')
    state().setPlaying(true)
    vi.advanceTimersByTime(first.frame * MOTION.quietPassMs)
    expect(state()).toMatchObject({ frame: first.frame, chapter: 1 })
    vi.advanceTimersByTime(MOTION.changePassMs - 1)
    expect(state().frame).toBe(first.frame)
    vi.advanceTimersByTime(1)
    expect(state()).toMatchObject({ frame: first.frame + 1, chapter: 1 })
    vi.advanceTimersByTime((gap.lastBefore - first.frame) * MOTION.quietPassMs)
    expect(state()).toMatchObject({ frame: gap.lastBefore, gap: true, chapter: null })
    vi.advanceTimersByTime(MOTION.gapHoldMs - 1)
    expect(state().gap).toBe(true)
    vi.advanceTimersByTime(1)
    expect(state()).toMatchObject({ frame: gap.firstAfter, gap: false, chapter: null })
  })

  it('stands still while paused and resumes the stop it was paused on', () => {
    const { story } = ready()
    const second = story.chapters[1]
    if (second === undefined) throw new Error('chapter 2')
    state().setPlaying(true)
    const steps = peopleSchedule()
    const stop = steps.findIndex((s) => s.frame === second.frame)
    vi.advanceTimersByTime(totalMs(steps.slice(0, stop)) + 1000)
    expect(state().chapter).toBe(2)
    state().setPlaying(false)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(state()).toMatchObject({ frame: second.frame, chapter: 2, paused: true })
    state().setPlaying(true)
    expect(state()).toMatchObject({ frame: second.frame, chapter: 2, playing: true })
    vi.runAllTimers()
    expect(state().panel).toBe('recap')
  })

  it('freezes a ?chapter stop with nothing running, and plays on from it', () => {
    const { story } = ready()
    const third = story.chapters[2]
    if (third === undefined) throw new Error('chapter 3')
    state().freezeChapter(3)
    vi.advanceTimersByTime(60_000)
    expect(state()).toMatchObject({ frame: third.frame, chapter: 3, paused: true, playing: false })
    state().setPlaying(true)
    vi.advanceTimersByTime(MOTION.changePassMs - 1)
    expect(state().frame).toBe(third.frame)
    vi.advanceTimersByTime(1)
    expect(state()).toMatchObject({ frame: third.frame + 1, chapter: 3 })
  })

  it('plays Business from 22 Jun 2026 to the last pass and stays in Business', () => {
    const { frames } = ready()
    state().setMode('business')
    const startedAt = Date.now()
    state().setPlaying(true)
    const start = state().frame
    expect(frames[start]?.time).toBe('2026-06-22T17:43:22Z')
    vi.runAllTimers()
    expect(Date.now() - startedAt).toBe((frames.length - start) * MOTION.quietPassMs)
    expect(state()).toMatchObject({
      mode: 'business',
      panel: 'rest',
      playing: false,
      frame: frames.length - 1,
      chapter: null,
    })
  })

  it('stops the timers when the person moves the timeline by hand', () => {
    state().setPlaying(true)
    vi.advanceTimersByTime(1000)
    state().setFrame(30)
    expect(vi.getTimerCount()).toBe(0)
    expect(state()).toMatchObject({ frame: 30, playing: false, chapter: null })
  })
})
