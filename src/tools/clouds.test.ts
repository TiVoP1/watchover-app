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
import { buildStory, chapterByNumber } from '#web/story/chapters.ts'
import { groundSizeM } from '#web/story/crop.ts'
import { cloudsPair, coverCrop, sameGround } from '#web/tools/clouds.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,clouds,weather,events}.json',
    '/public/data/stalowa-wola/insar/{insar,objects,null_check}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/stalowa-wola/${path}`] ?? null
const nullCheck = file('insar/null_check.json')

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
  play: null,
  eventPairs: null,
}

const story = buildStory(data)
const WIDE = 912 / 508

describe('cloudsPair', () => {
  it('shows the cloudy photo and the radar of the same day around the open change', () => {
    const chapter = chapterByNumber(story, 3)
    const pair = chapter === null ? null : cloudsPair(data, 0, chapter, WIDE)
    expect(pair?.photo.path).toBe('optical/2026-09-15.webp')
    expect(pair?.pass.time.slice(0, 10)).toBe('2026-09-15')
    expect(pair?.radar.path).toBe(pair?.pass.frame)
    expect(pair?.cloudPct).toBe(68)
    expect(pair?.kind).toBe('forest')
    const outline = pair?.outline
    expect(outline?.x).toBeGreaterThan(0)
    expect((outline?.x ?? 1) + (outline?.w ?? 1)).toBeLessThan(1)
  })

  it('crops both images to the shape of the view on the ground', () => {
    const chapter = chapterByNumber(story, 3)
    const pair = chapter === null ? null : cloudsPair(data, 0, chapter, WIDE)
    const radar = data.radar as RadarMeta
    const { widthM, heightM } = groundSizeM(radar.corners_lonlat)
    const crop = pair?.radar.crop ?? { w: 0, h: 1 }
    expect((crop.w * widthM) / (crop.h * heightM)).toBeCloseTo(WIDE, 2)
  })

  it('falls back to the whole view on the day under the timeline head', () => {
    const pair = cloudsPair(data, story.restFrame, null, WIDE)
    const head = data.radar?.frames[story.restFrame]
    expect(pair?.pass).toBe(head)
    expect(pair?.photo.path).toBe(`optical/${head?.time.slice(0, 10) ?? ''}.webp`)
    expect(pair?.cloudPct).toBe(100)
    expect(pair?.outline).toBeNull()
    expect(pair?.radar.crop).toEqual(coverCrop(WIDE))
  })

  it('uses the whole view when the open change had a clear sky', () => {
    const clear = story.chapters.find((c) => c.clouds === null)
    const pair = clear === undefined ? null : cloudsPair(data, clear.frame, clear, WIDE)
    expect(pair?.pass).toBe(data.radar?.frames[clear?.frame ?? -1])
    expect(pair?.outline).toBeNull()
  })

  it('treats a change over the whole view as the whole view', () => {
    const frost = story.chapters.find((c) => c.kind === 'frost')
    const pair = frost === undefined ? null : cloudsPair(data, frost.frame, frost, WIDE)
    expect(frost?.areaHa).toBeNull()
    expect(pair?.outline ?? null).toBeNull()
  })
})

describe('sameGround', () => {
  it('crops the photo to the ground of the radar crop, centred on the same point', () => {
    const radar = data.radar as RadarMeta
    const clouds = data.clouds as Clouds
    const [west, south, east, north] = clouds.bbox_lonlat
    const photoCorners = [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ] as const
    const crop = { x: 0.4, y: 0.6, w: 0.5, h: 0.3 }
    const photo = sameGround(radar.corners_lonlat, photoCorners, crop)
    const radarSize = groundSizeM(radar.corners_lonlat)
    const photoSize = groundSizeM(photoCorners)
    expect(photo.w * photoSize.widthM).toBeCloseTo(crop.w * radarSize.widthM, 6)
    expect(photo.h * photoSize.heightM).toBeCloseTo(crop.h * radarSize.heightM, 6)
    expect(photo.x + photo.w / 2).toBeCloseTo(0.65, 1)
    expect(photo.y + photo.h / 2).toBeCloseTo(0.75, 1)
  })
})

describe('coverCrop', () => {
  it('keeps the middle band of the square that fills the view', () => {
    expect(coverCrop(2)).toEqual({ x: 0, y: 0.25, w: 1, h: 0.5 })
    expect(coverCrop(0.5)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
    expect(coverCrop(1)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})
