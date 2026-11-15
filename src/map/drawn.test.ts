import { describe, expect, it } from 'vitest'
import { isNullCheck } from '#web/data/load.ts'
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
import {
  businessFrame,
  type DrawInput,
  frostMask,
  PARTIAL_MIN_SHARE,
  radarFrame,
  radarImage,
  transparentShare,
  useDrawn,
} from '#web/map/drawn.ts'
import { buildStory, chapterByNumber, playStartFrame } from '#web/story/chapters.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,clouds,weather,events}.json',
    '/public/data/stalowa-wola/insar/{insar,objects,null_check}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null

const nullCheck = file('stalowa-wola/insar/null_check.json')
const data: PlaceData = {
  slug: 'stalowa-wola',
  catalog: file('stalowa-wola/catalog.json') as Catalog,
  radar: file('stalowa-wola/radar.json') as RadarMeta,
  clouds: file('stalowa-wola/clouds.json') as Clouds,
  weather: file('stalowa-wola/weather.json') as Weather,
  insar: file('stalowa-wola/insar/insar.json') as InsarMeta,
  objects: file('stalowa-wola/insar/objects.json') as Objects,
  events: file('stalowa-wola/events.json') as Events,
  footprints: null,
  nullCheck: isNullCheck(nullCheck) ? nullCheck : null,
  story: null,
  ground: null,
  play: null,
  eventPairs: null,
}
const story = buildStory(data)
const frames = data.radar?.frames ?? []
const rest: DrawInput = {
  data,
  story,
  frame: story.restFrame,
  item: null,
  business: false,
}

const frameOf = (input: DrawInput) => {
  const index = radarFrame(input)
  return index === null ? undefined : frames[index]
}

describe('radarFrame', () => {
  it('rests on the last pass of the background track', () => {
    expect(frameOf(rest)?.track).toBe(story.background?.track)
    expect(radarFrame(rest)).toBe(story.restFrame)
  })

  it('keeps the background track between Play stops, so the geometry never jumps', () => {
    const quiet = frames.findIndex(
      (f, i) => f.track !== story.background?.track && story.chapters.every((c) => c.frame !== i),
    )
    expect(quiet).toBeGreaterThan(-1)
    expect(frameOf({ ...rest, frame: quiet })?.track).toBe(story.background?.track)
  })

  it('draws the pass of a Play stop and of an open Card', () => {
    const forest = chapterByNumber(story, 2)
    if (forest === null) throw new Error('missing forest chapter')
    expect(radarFrame({ ...rest, frame: forest.frame })).toBe(forest.frame)
    expect(radarFrame({ ...rest, item: forest })).toBe(forest.frame)
  })

  it('stays on the background track in Business', () => {
    const forest = chapterByNumber(story, 2)
    const shown = frameOf({ ...rest, frame: forest?.frame ?? 0, business: true })
    expect(shown?.track).toBe(story.background?.track)
  })

  it('starts Business Play on the first background pass after the data gap, not on a winter one', () => {
    const start = playStartFrame(data, 'business')
    const shown = frameOf({ ...rest, frame: start, business: true })
    expect(frames[start]?.time).toBe('2026-06-22T17:43:22Z')
    expect(shown?.track).toBe(story.background?.track)
    expect(shown?.time).toBe('2026-06-28T03:13:39Z')
  })

  it('never reaches across the data gap for a Business picture once the track passes again', () => {
    for (const head of frames.keys()) {
      const index = businessFrame(story, frames, head)
      const gap = story.gap
      if (gap !== null && head >= gap.firstAfter) expect(index).toBeGreaterThan(gap.lastBefore)
      if (frames[head]?.track === story.background?.track) expect(index).toBe(head)
    }
  })
})

describe('radarImage', () => {
  it('serves the grey frame or the labelled false colour one', () => {
    const index = radarFrame(rest)
    const frame = frames[story.restFrame]
    expect(radarImage(data, index, false)?.url).toBe(`/data/stalowa-wola/${frame?.frame ?? ''}`)
    expect(radarImage(data, index, true)?.url).toBe(
      `/data/stalowa-wola/${frame?.false_colour ?? ''}`,
    )
  })

  it('has nothing to draw for a pass that does not exist', () => {
    expect(radarImage(data, frames.length, false)).toBeNull()
    expect(radarImage(data, null, false)).toBeNull()
  })
})

describe('frostMask', () => {
  const frost = chapterByNumber(story, 1)

  it('whitens the frozen forest on the frost stop and in its Card', () => {
    const expected = {
      url: '/data/stalowa-wola/events/frost.png',
      corners: data.events?.corners_lonlat,
    }
    expect(frostMask({ ...rest, frame: frost?.frame ?? -1 })).toEqual(expected)
    expect(frostMask({ ...rest, item: frost })).toEqual(expected)
  })

  it('leaves every other picture alone', () => {
    expect(frostMask(rest)).toBeNull()
    expect(frostMask({ ...rest, item: chapterByNumber(story, 2) })).toBeNull()
    expect(frostMask({ ...rest, frame: frost?.frame ?? -1, business: true })).toBeNull()
  })
})

describe('radar coverage', () => {
  const pixel = (alpha: number) => [10, 10, 10, alpha]

  it('counts the share of pixels the radar left empty', () => {
    expect(transparentShare([...pixel(255), ...pixel(0), ...pixel(0), ...pixel(200)])).toBe(0.5)
    expect(transparentShare([])).toBe(0)
    expect(transparentShare([...pixel(255), ...pixel(255)])).toBeLessThan(PARTIAL_MIN_SHARE)
  })

  it('keeps the flag only for the image still on screen', () => {
    const drawn = useDrawn.getState()
    drawn.setRadar({ url: '/a.webp', frame: 1, falseColour: false, pixelM: 20 })
    useDrawn.getState().setPartial('/old.webp', true)
    expect(useDrawn.getState().partial).toBe(false)
    useDrawn.getState().setPartial('/a.webp', true)
    expect(useDrawn.getState().partial).toBe(true)
    useDrawn.getState().setRadar({ url: '/b.webp', frame: 2, falseColour: false, pixelM: 20 })
    expect(useDrawn.getState().partial).toBe(false)
  })
})
