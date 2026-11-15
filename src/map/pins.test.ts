import { describe, expect, it } from 'vitest'
import { isNullCheck } from '#web/data/load.ts'
import type {
  Catalog,
  Clouds,
  Events,
  InsarMeta,
  ObjectFootprints,
  Objects,
  PlaceData,
  RadarMeta,
  Weather,
} from '#web/data/types.ts'
import { distanceKm } from '#web/film/geo.ts'
import { gridPoint } from '#web/map/frame.ts'
import { clickTarget, focusOf, restPins, shownPins } from '#web/map/pins.ts'
import { buildStory, chapterByNumber, type StoryItem } from '#web/story/chapters.ts'
import { bboxRect } from '#web/story/crop.ts'
import type { LonLat } from '#web/story/where.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,clouds,weather,events}.json',
    '/public/data/stalowa-wola/insar/{insar,objects,null_check}.json',
    '/public/data/stalowa-wola/insar/objects.geojson',
  ],
  { eager: true, import: 'default', query: '?raw' },
)

const file = (path: string): unknown => {
  const raw = files[`/public/data/${path}`]
  return typeof raw === 'string' ? (JSON.parse(raw) as unknown) : null
}

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
  footprints: file('stalowa-wola/insar/objects.geojson') as ObjectFootprints,
  nullCheck: isNullCheck(nullCheck) ? nullCheck : null,
  story: null,
  ground: null,
  play: null,
  eventPairs: null,
}
const story = buildStory(data)
const corners = data.radar?.corners_lonlat
if (corners === undefined) throw new Error('Stalowa Wola has no radar window')
const items: readonly StoryItem[] = [...story.chapters, ...story.secondary]

describe('restPins', () => {
  it('puts one disc on each chapter with a place, leaving out the scene-wide frost', () => {
    expect(restPins(story).map((p) => p.kind)).toEqual([
      'forest',
      'forest',
      'fields',
      'rework',
      'heat',
    ])
  })
})

describe('shownPins', () => {
  const second = chapterByNumber(story, 2)
  const last = story.chapters.at(-1)

  it('lets Play reveal each disc when it reaches the pass of that change', () => {
    const view = { inPlay: true, frame: second?.frame ?? -1, item: null }
    expect(shownPins(story, view).map((p) => p.id)).toEqual([second?.id])
    const end = { inPlay: true, frame: last?.frame ?? -1, item: null }
    expect(shownPins(story, end)).toHaveLength(5)
  })

  it('shows every disc at rest whatever the timeline head, and hides the one the Card redraws', () => {
    expect(shownPins(story, { inPlay: false, frame: 0, item: null })).toHaveLength(5)
    const open = shownPins(story, { inPlay: false, frame: 0, item: second?.id ?? null })
    expect(open.map((p) => p.id)).not.toContain(second?.id)
  })
})

describe('focusOf', () => {
  it('outlines a forest change by its box and stands its disc on the north edge', () => {
    const forest = chapterByNumber(story, 2)
    if (forest === null) throw new Error('missing forest chapter')
    const focus = focusOf(forest, data)
    expect(focus.outline?.geometry.type).toBe('Polygon')
    const [west, , east, north] = forest.bbox
    expect(focus.tag).toEqual([(west + east) / 2, north])
  })

  it('outlines the building by its OpenStreetMap footprint', () => {
    const building = story.chapters.find((c) => c.kind === 'heat')
    if (building?.kind !== 'heat') throw new Error('missing building chapter')
    const footprint = data.footprints?.features.find(
      (f) => f.properties.osm === building.heat.object.osm,
    )
    expect(focusOf(building, data).outline?.geometry).toEqual(footprint?.geometry)
  })

  it('draws no outline for the frost, which covers half the view', () => {
    const frost = chapterByNumber(story, 1)
    if (frost === null) throw new Error('missing frost chapter')
    expect(focusOf(frost, data)).toEqual({ outline: null, tag: null })
  })
})

describe('clickTarget', () => {
  const far = (point: LonLat, km: number) =>
    items.every((i) => distanceKm(point, i.lonLat) > km) &&
    (data.events?.events ?? []).every((e) => distanceKm(point, [e.lon, e.lat]) > km) &&
    (data.insar?.activity_events ?? [])
      .filter((a) => !a.weather_suspect)
      .every((a) => distanceKm(point, [a.lon, a.lat]) > km)

  it('opens the change under the click', () => {
    const forest = chapterByNumber(story, 2)
    expect(clickTarget(story, data, forest?.lonLat ?? [0, 0])).toEqual({
      kind: 'item',
      id: forest?.id,
    })
  })

  it('answers outside the watched window with the fog sentence', () => {
    expect(clickTarget(story, data, gridPoint(corners, 1.3, 0.5))).toEqual({ kind: 'fog' })
  })

  it('says the spot is quiet only far from every detection', () => {
    const steps = Array.from({ length: 19 }, (_, i) => (i + 0.5) / 19)
    const quiet = steps
      .flatMap((u) => steps.map((v) => gridPoint(corners, u, v)))
      .find((p) => far(p, 3))
    if (quiet === undefined) throw new Error('no quiet spot in the window')
    expect(clickTarget(story, data, quiet)).toEqual({ kind: 'quiet' })
  })

  it('keeps quiet next to a detection that is not one of the changes we tell', () => {
    const dropped = (data.events?.events ?? []).find(
      (e) =>
        bboxRect(corners, e.bbox).w * bboxRect(corners, e.bbox).h < 0.5 &&
        (e.confidence === 'low' || e.caveats.length > 0) &&
        items.every((i) => distanceKm([e.lon, e.lat], i.lonLat) > 3),
    )
    if (dropped === undefined) throw new Error('no dropped detection away from the changes')
    expect(clickTarget(story, data, [dropped.lon, dropped.lat])).toEqual({ kind: 'none' })
  })
})
