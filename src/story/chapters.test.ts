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
  backgroundFrame,
  buildStory,
  chapterAt,
  chapterByNumber,
  displayFrame,
  heatOf,
  heatRange,
  itemById,
  playStartFrame,
  type StoryItem,
} from '#web/story/chapters.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,clouds,weather,events}.json',
    '/public/data/stalowa-wola/insar/{insar,objects,null_check}.json',
    '/public/data/mexico-city/{catalog,radar}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null

function stalowaWola(overrides: Partial<PlaceData> = {}): PlaceData {
  const nullCheck = file('stalowa-wola/insar/null_check.json')
  return {
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
    ...overrides,
  }
}

const day = (item: StoryItem | undefined) => item?.time.slice(0, 10)
const data = stalowaWola()
const story = buildStory(data)
const frames = data.radar?.frames ?? []

describe('buildStory chapters', () => {
  it('tells six chapters in time order, the building last', () => {
    expect(story.chapters.map((c) => c.kind)).toEqual([
      'frost',
      'forest',
      'forest',
      'fields',
      'rework',
      'heat',
    ])
    expect(story.chapters.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6])
    expect(story.chapters.map(day)).toEqual([
      '2025-12-25',
      '2026-08-10',
      '2026-09-15',
      '2026-10-09',
      '2026-10-14',
      '2026-10-20',
    ])
    expect(story.changes).toHaveLength(5)
    expect(story.changes.some((c) => c.kind === 'heat')).toBe(false)
  })

  it('shows the frozen morning on the whole view, with its mask and a BETA flag', () => {
    const frost = story.chapters[0]
    if (frost?.kind !== 'frost' || frost.tile.variant !== 'radar') throw new Error('frost tile')
    expect(frost.tile.before.time.slice(0, 10)).toBe('2025-12-13')
    expect(frost.tile.mask).toBe('events/frost.png')
    expect(frost.tile.outline).toBeNull()
    expect(frost.where.kind).toBe('view')
    if (frost.where.kind === 'view') expect(frost.where.share).toBeGreaterThan(0.45)
    expect(frost.tempC).toBeCloseTo(-8.6, 1)
    expect(frost.flags).toEqual({ early: true, estimate: true })
    expect(frost.confidence).toBe('high')
    expect(frost.areaHa).toBeNull()
    expect(frost.clouds).toBeNull()
  })

  it('never lays the all-winter frost mask over another frozen morning', () => {
    const others = story.secondary.filter((s) => s.kind === 'frost')
    expect(others.length).toBeGreaterThan(0)
    for (const item of others) {
      expect(item.tile.variant === 'radar' ? item.tile.mask : null).toBeNull()
    }
  })

  it('pairs the forest patch with the last pass of the same track, in false colour', () => {
    const forest = story.chapters[1]
    if (forest?.tile.variant !== 'radar') throw new Error('forest tile')
    expect(forest.areaHa).toBeCloseTo(4.1, 1)
    expect(forest.tile.colour).toBe('false')
    expect(forest.tile.before.time.slice(0, 10)).toBe('2026-07-17')
    expect(forest.source.passes.map((p) => p.track)).toEqual([129, 129])
    expect(forest.where).toMatchObject({ kind: 'away', km: 6 })
    expect(forest.insetTile).toBe(forest.tile)
    expect(forest.clouds?.cloudShare).toBeCloseTo(0.925, 3)
  })

  it('reads track and time from the frames drawn and sends the faint crop to the card', () => {
    const forest = story.chapters[2]
    if (forest?.kind !== 'forest' || forest.tile.variant !== 'radar') throw new Error('tile')
    expect(forest.areaHa).toBeCloseTo(3.5, 1)
    expect(frames[forest.frame]?.time).toBe('2026-09-15T03:21:55Z')
    expect(forest.source.passes.map((p) => [p.time.slice(0, 10), p.track, p.direction])).toEqual([
      ['2026-09-03', 129, 'ASCENDING'],
      ['2026-09-15', 129, 'ASCENDING'],
    ])
    expect(forest.insetTile.variant).toBe('clouds')
    expect(forest.insetTile).toBe(forest.clouds)
    if (forest.insetTile.variant === 'clouds') {
      expect(forest.insetTile.cloudShare).toBeCloseTo(0.677, 3)
      expect(forest.insetTile.optical.path).toBe('optical/2026-09-15.webp')
      expect(forest.insetTile.radar.time).toBe('2026-09-15T03:21:55Z')
    }
    expect(forest.where).toEqual({ kind: 'away', km: 10, toward: 'south' })
  })

  it('shows the field change in grey between 27 Sep and 9 Oct', () => {
    const fields = story.chapters[3]
    if (fields?.tile.variant !== 'radar') throw new Error('fields tile')
    expect(fields.tile.colour).toBe('grey')
    expect(fields.tile.before.time.slice(0, 10)).toBe('2026-09-27')
    expect(fields.areaHa).toBeCloseTo(20, 0)
    expect(fields.confidence).toBe('medium')
    expect(fields.where).toEqual({ kind: 'away', km: 16, toward: 'south-east' })
  })

  it('shows the ground rework as two coherence pairs around the town centre', () => {
    const rework = story.chapters[4]
    if (rework?.kind !== 'rework' || rework.tile.variant !== 'coherence') throw new Error('tile')
    expect(rework.tile.before.path).toBe('insar/coherence-06.png')
    expect(rework.tile.after.path).toBe('insar/coherence-07.png')
    expect(rework.tile.after.from?.slice(0, 10)).toBe('2026-10-02')
    expect(rework.areaHa).toBeCloseTo(2.24, 2)
    expect(rework.where).toEqual({ kind: 'centre' })
    expect(rework.confidence).toBe('high')
    expect(rework.source.product).toBe('GSLC')
    expect(rework.source.passes.map((p) => p.time.slice(0, 10))).toEqual([
      '2026-09-20',
      '2026-10-02',
      '2026-10-14',
    ])
  })

  it('ends on the building that beats open ground, told from the evening orbit only', () => {
    const heat = story.chapters[5]
    if (heat?.kind !== 'heat') throw new Error('heat chapter')
    const { evening, object } = heat.heat
    expect(object.osm).toBe('way/359317018')
    expect(frames[heat.frame]?.time).toBe('2026-10-20T17:43:18Z')
    expect(heat.areaHa).toBeCloseTo(6.4, 1)
    expect(heat.where).toEqual({ kind: 'away', km: 3, toward: 'south' })
    expect(heat.confidence).toBe('high')
    expect(heat.flags).toEqual({ early: false, estimate: true })
    expect(evening?.track).toBe(123)
    expect(evening?.passes[evening.hot]).toMatchObject({ tempC: 26.9, losMmFromColdest: 5.4 })
    expect(evening?.passes[evening.cold]).toMatchObject({ tempC: 10.6, losMmFromColdest: 0 })
    expect(evening?.hotColdMm).toBe(5.4)
    expect(evening?.hotColdErrMm).toBe(1.2)
    expect(heat.range).toMatchObject({ loMm: 4, hiMm: 5, mmPerC: 0.302, mmPerCErr: 0.058 })
    expect(heat.range.rangeC).toBeCloseTo(16.3, 6)
    expect(heat.range.passes).toBe(9)
    expect(new Set(heat.source.passes.map((p) => p.track))).toEqual(new Set([123]))
    expect(heat.source.passes).toHaveLength(9)
    expect(heat.insetTile).toBe(heat.tile)
  })
})

describe('buildStory selection', () => {
  it('keeps the same chapters when the pipeline renumbers events', () => {
    const events = data.events
    if (events === null) throw new Error('events')
    const renumbered = {
      ...events,
      events: [...events.events].reverse().map((e, i) => ({ ...e, id: `renamed-${String(i)}` })),
    }
    const again = buildStory(stalowaWola({ events: renumbered }))
    expect(again.chapters.map((c) => c.id)).toEqual(story.chapters.map((c) => c.id))
  })

  it('tells no building without the open-ground test', () => {
    const kinds = buildStory(stalowaWola({ nullCheck: null })).chapters.map((c) => c.kind)
    expect(kinds).not.toContain('heat')
    expect(kinds).toHaveLength(5)
  })

  it('drops the building chapter when no building beats open ground', () => {
    const nullCheck = data.nullCheck
    if (nullCheck == null) throw new Error('null check')
    const none = {
      ...nullCheck,
      objects: nullCheck.objects.map((o) => ({ ...o, label: 'like_open_ground' as const })),
    }
    const kinds = buildStory(stalowaWola({ nullCheck: none })).chapters.map((c) => c.kind)
    expect(kinds).not.toContain('heat')
    expect(kinds).toHaveLength(5)
  })

  it('lists only caveat-free changes under More changes, never a chapter twice', () => {
    const ids = [...story.chapters, ...story.secondary].map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(story.secondary).toHaveLength(11)
    for (const item of story.secondary) {
      expect(item.n).toBeNull()
      expect(item.confidence).not.toBe('low')
      if ('event' in item) expect(item.event.caveats).toEqual([])
    }
    expect(itemById(story, story.chapters[1]?.id ?? '')).toBe(story.chapters[1])
    expect(chapterByNumber(story, 3)).toBe(story.chapters[2])
    expect(chapterByNumber(story, 7)).toBeNull()
  })

  it('tells nothing for a place with radar only', () => {
    const mexico = buildStory({
      slug: 'mexico-city',
      catalog: file('mexico-city/catalog.json') as Catalog,
      radar: file('mexico-city/radar.json') as RadarMeta,
      clouds: null,
      weather: null,
      insar: null,
      objects: null,
      events: null,
      footprints: null,
      nullCheck: null,
      story: null,
      ground: null,
      play: null,
      eventPairs: null,
    })
    expect(mexico.chapters).toEqual([])
    expect(mexico.secondary).toEqual([])
    expect(mexico.passes).toBeGreaterThan(0)
    expect(mexico.restFrame).toBeLessThan(mexico.passes)
  })
})

describe('heat helpers', () => {
  it('tells the outlier from its evening slope, which is negative', () => {
    const objects = data.objects
    const outlier = objects?.objects.find((o) => o.osm === 'way/359422657')
    if (objects === null || outlier === undefined) throw new Error('outlier')
    const heat = heatOf(objects, outlier)
    expect(heat.evening?.mmPerC).toBe(-0.267)
    expect(heat.evening?.mmPerCErr).toBe(0.06)
    expect(heat.dawn?.track).toBe(28)
  })

  it('needs two temperatures for a range', () => {
    const heat = story.chapters[5]
    if (heat?.kind !== 'heat' || heat.heat.evening === null) throw new Error('heat chapter')
    const lonely = { ...heat.heat.evening, passes: heat.heat.evening.passes.slice(0, 1) }
    expect(heatRange(lonely, 1)).toBeNull()
  })
})

describe('buildStory facts', () => {
  it('finds the data gap in the catalog and the frames on each side', () => {
    expect(story.gap?.from.slice(0, 10)).toBe('2026-01-18')
    expect(story.gap?.to.slice(0, 10)).toBe('2026-06-17')
    expect(story.gap?.lastBefore).toBe(11)
    expect(story.gap?.firstAfter).toBe(12)
  })

  it('counts the ground signals set aside as weather and their months', () => {
    expect(story.weather).toMatchObject({ setAside: 645, total: 656 })
    expect(story.weather?.from.slice(0, 10)).toBe('2026-06-28')
    expect(story.weather?.to.slice(0, 10)).toBe('2026-08-15')
  })

  it('carries the cloud count, the pass count, the view size and the resting frame', () => {
    expect(story.clouds).toEqual({ cloudyDays: 30, passDays: 53 })
    expect(story.passes).toBe(52)
    expect(story.pixelM).toBe(20)
    expect(Math.round(story.viewKm?.width ?? 0)).toBe(30)
    expect(story.background).toEqual({ track: 28, direction: 'ASCENDING' })
    expect(frames[story.restFrame]?.time).toBe('2026-10-26T03:13:36Z')
  })
})

describe('frames to draw', () => {
  it('draws the background track between stops and the pass itself at a stop', () => {
    const forest = story.chapters[1]
    if (forest === undefined) throw new Error('forest')
    expect(frames[30]?.track).toBe(51)
    expect(displayFrame(story, frames, 30, null)).toBe(29)
    expect(displayFrame(story, frames, forest.frame, null)).toBe(forest.frame)
    expect(displayFrame(story, frames, 3, forest)).toBe(forest.frame)
    expect(chapterAt(story, forest.frame)).toBe(forest)
    expect(chapterAt(story, 30)).toBeNull()
  })

  it('holds the first background frame before the track starts', () => {
    expect(backgroundFrame(frames, { track: 123, direction: 'DESCENDING' }, 3)).toBe(12)
    expect(backgroundFrame(frames, null, 3)).toBe(3)
  })

  it('starts Play at the first pass, and in Business at the first evening pass', () => {
    expect(playStartFrame(data, 'people')).toBe(0)
    expect(frames[playStartFrame(data, 'business')]?.time).toBe('2026-06-22T17:43:22Z')
  })
})
