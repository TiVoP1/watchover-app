import { afterEach, describe, expect, it, vi } from 'vitest'
import { dataUrl, isNullCheck, isPlayMeta } from '#web/data/load.ts'
import type {
  Catalog,
  Clouds,
  Events,
  InsarMeta,
  Objects,
  PlaceData,
  RadarMeta,
  Weather,
} from '#web/data/types.ts'
import { businessFrame } from '#web/map/drawn.ts'
import { playFrame, playImage, playOrder, preloadImages } from '#web/map/play-frames.ts'
import {
  backgroundFrame,
  type Chapter,
  chapterByNumber,
  buildStory,
  playStartFrame,
} from '#web/story/chapters.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,radar-play,clouds,weather,events}.json',
    '/public/data/stalowa-wola/insar/{insar,objects,null_check}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/stalowa-wola/${path}`] ?? null

const nullCheck = file('insar/null_check.json')
const light = file('radar-play.json')
const data: PlaceData = {
  slug: 'stalowa-wola',
  catalog: file('catalog.json') as Catalog,
  radar: file('radar.json') as RadarMeta,
  clouds: file('clouds.json') as Clouds,
  weather: file('weather.json') as Weather,
  insar: file('insar/insar.json') as InsarMeta,
  objects: file('insar/objects.json') as Objects,
  events: file('events.json') as Events,
  footprints: null,
  nullCheck: isNullCheck(nullCheck) ? nullCheck : null,
  story: null,
  ground: null,
  play: isPlayMeta(light) ? light : null,
  eventPairs: null,
}
const story = buildStory(data)
const frames = data.radar?.frames ?? []
const background = story.background?.track

function chapter(n: number): Chapter {
  const found = chapterByNumber(story, n)
  if (found === null) throw new Error(`chapter ${String(n)}`)
  return found
}

const lightOf = (url: string | undefined) =>
  data.play?.frames.find((f) => dataUrl(data.slug, f.frame) === url)

describe('playImage', () => {
  it('draws the light copy of the very same pass, at 30 m pixels', () => {
    for (const [i, pass] of frames.entries()) {
      const image = playImage(data, i)
      const copy = lightOf(image?.url)
      expect(copy?.time).toBe(pass.time)
      expect(copy?.scene).toBe(pass.scene)
      expect(image?.frame).toBe(i)
      expect(image?.pixelM).toBe(30)
      expect(image?.falseColour).toBe(false)
    }
  })

  it('has no light copy without a manifest or for a pass that does not exist', () => {
    expect(playImage({ ...data, play: null }, 0)).toBeNull()
    expect(playImage(data, frames.length)).toBeNull()
  })
})

describe('playFrame', () => {
  it('draws each stop on its own pass and the background track between stops', () => {
    for (const c of story.chapters) expect(playFrame(story, frames, c.frame)).toBe(c.frame)
    const quiet = frames.findIndex(
      (f, i) => f.track !== background && story.chapters.every((c) => c.frame !== i),
    )
    expect(quiet).toBeGreaterThan(0)
    expect(frames[playFrame(story, frames, quiet)]?.track).toBe(background)
  })

  it('never draws a pass after the head', () => {
    for (const head of frames.keys()) {
      expect(playFrame(story, frames, head)).toBeLessThanOrEqual(head)
    }
  })

  it('keeps a stop on another track until the background track passes again', () => {
    const building = chapter(6)
    const after = building.frame + 1
    expect(frames[building.frame]?.track).not.toBe(background)
    expect(frames[after]?.track).not.toBe(background)
    expect(backgroundFrame(frames, story.background, after)).toBe(chapter(5).frame)
    expect(playFrame(story, frames, after)).toBe(building.frame)
  })

  it('keeps the last image before the data gap until the track passes again', () => {
    const gap = story.gap
    if (gap === null) throw new Error('gap')
    expect(frames[playFrame(story, frames, gap.firstAfter)]?.time).toBe('2026-01-11T03:13:40Z')
  })
})

describe('playOrder', () => {
  it('lists people Play from 19 Oct 2025: 17 background passes and 5 stops on other tracks', () => {
    const order = playOrder(data, story, 'people')
    expect(lightOf(order[0])?.time).toBe('2025-10-19T03:13:36Z')
    expect(order).toHaveLength(22)
    expect(order.every((url) => lightOf(url) !== undefined)).toBe(true)
  })

  it('lists Business Play from the pass it starts on', () => {
    const start = businessFrame(story, frames, playStartFrame(data, 'business'))
    expect(playOrder(data, story, 'business')[0]).toBe(playImage(data, start)?.url)
  })

  it('has nothing to list without light frames', () => {
    expect(playOrder({ ...data, play: null }, story, 'people')).toEqual([])
  })
})

class FakeImage {
  static started: string[] = []
  static finish: (() => void)[] = []
  decoding = ''
  src = ''
  decode(): Promise<void> {
    FakeImage.started.push(this.src)
    return new Promise((resolve) => {
      FakeImage.finish.push(resolve)
    })
  }
}

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

describe('preloadImages', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeImage.started = []
    FakeImage.finish = []
  })

  it('fetches in Play order, a few at a time, and stops when cancelled', async () => {
    vi.stubGlobal('Image', FakeImage)
    const urls = ['/p/a.webp', '/p/b.webp', '/p/c.webp', '/p/d.webp', '/p/e.webp']
    const cancel = preloadImages(urls, 2)
    expect(FakeImage.started).toEqual(['/p/a.webp', '/p/b.webp'])
    FakeImage.finish[0]?.()
    await settle()
    expect(FakeImage.started).toEqual(['/p/a.webp', '/p/b.webp', '/p/c.webp'])
    cancel()
    for (const done of FakeImage.finish) done()
    await settle()
    expect(FakeImage.started).toHaveLength(3)
  })
})
