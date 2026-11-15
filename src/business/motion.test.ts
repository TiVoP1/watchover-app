import { describe, expect, it } from 'vitest'
import {
  businessRows,
  earlyResult,
  eveningPopulation,
  watchCandidate,
} from '#web/business/motion.ts'
import { isNullCheck } from '#web/data/load.ts'
import type {
  Catalog,
  MotionObject,
  NullCheck,
  NullLabel,
  Objects,
  PlaceData,
  RadarMeta,
  Weather,
} from '#web/data/types.ts'
import { buildStory } from '#web/story/chapters.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,weather}.json',
    '/public/data/stalowa-wola/insar/{objects,null_check}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null

const realCheck = file('stalowa-wola/insar/null_check.json')

const real: PlaceData = {
  slug: 'stalowa-wola',
  catalog: file('stalowa-wola/catalog.json') as Catalog,
  radar: file('stalowa-wola/radar.json') as RadarMeta,
  clouds: null,
  weather: file('stalowa-wola/weather.json') as Weather,
  insar: null,
  objects: file('stalowa-wola/insar/objects.json') as Objects,
  events: null,
  footprints: null,
  nullCheck: isNullCheck(realCheck) ? realCheck : null,
  story: null,
  ground: null,
  play: null,
  eventPairs: null,
}

const evening = (mm_per_c: number | null) => ({
  coherence: 0.9,
  los_mm: [0, 1, 2],
  mm_per_c,
  mm_per_c_err: mm_per_c === null ? null : 0.1,
  resid_mm: 1,
  hot_cold_mm: 1,
  hot_cold_err_mm: 1,
})

const object = (
  osm: string,
  kind: MotionObject['kind'],
  slope: number | null,
  extra: Partial<MotionObject> = {},
): MotionObject => ({
  osm,
  kind,
  name: null,
  area_m2: 10_000,
  lon: 22.05,
  lat: 50.55,
  tracks: { '28A': evening(0.5), '123D': evening(slope) },
  vertical_consistent: true,
  mm_per_c: 0.9,
  mm_per_c_err: 0.01,
  ...extra,
})

const objects: Objects = {
  crid: 'P05023',
  level: 'GSLC',
  los_sign_verified: true,
  temperature_estimate: true,
  attribution: '',
  tracks: {
    '28A': {
      track: 28,
      direction: 'ASCENDING',
      passes: ['2026-06-28T03:13:39Z', '2026-07-10T03:13:38Z', '2026-07-22T03:13:37Z'],
      scenes: ['a0', 'a1', 'a2'],
      temperature_c: [24, 12, 3],
      hot_pass: 0,
      cold_pass: 2,
    },
    '123D': {
      track: 123,
      direction: 'DESCENDING',
      passes: ['2026-06-22T17:43:22Z', '2026-07-04T17:43:21Z', '2026-10-20T17:43:20Z'],
      scenes: ['d0', 'd1', 'd2'],
      temperature_c: [23, 27, 11],
      hot_pass: 1,
      cold_pass: 2,
    },
  },
  objects: [
    object('way/clear', 'building', 0.3, { area_m2: 5000 }),
    object('way/sinks', 'building', -0.4),
    object('way/sinks-less', 'building', -0.2),
    object('way/bridge', 'bridge', -0.9),
    object('way/named', 'building', 0.1, { name: 'Kaufland', area_m2: 2000 }),
    object('way/big', 'building', 0.05, { area_m2: 90_000 }),
    object('way/edge', 'building', 0.2),
    object('way/none', 'building', null),
  ],
}

const checked = (osm: string, label: NullLabel, z: number | null) => ({
  osm,
  z: { '28': 0.4, '123': z },
  squares_same_direction: 0,
  squares_any_direction: 0,
  label,
})

const nullCheck: NullCheck = {
  method: {},
  generated_from: [],
  passes_per_track: 9,
  seed: 1,
  squares_coherent_both: 100,
  same_sign_share: 0.5,
  both_beyond_2_same_sign_share: 0.02,
  z_p95: { '28': 2.9, '123': 2.9 },
  t_expected_p95: 2.36,
  error_inflation: 1.2,
  histogram: { bin_edges: [], counts: [] },
  objects: [
    checked('way/clear', 'beats_all', 5),
    checked('way/sinks', 'like_open_ground', -4.5),
    checked('way/sinks-less', 'like_open_ground', -3),
    checked('way/bridge', 'like_open_ground', -9),
    checked('way/named', 'like_open_ground', 1),
    checked('way/big', 'like_open_ground', 0.5),
    checked('way/edge', 'borderline', -6),
    checked('way/none', 'like_open_ground', null),
  ],
  temperature_estimate: true,
  source: '',
}

const place = (overrides: Partial<PlaceData> = {}): PlaceData => ({
  ...real,
  objects,
  nullCheck,
  ...overrides,
})

describe('watchCandidate', () => {
  it('picks the building that sinks furthest beyond open ground on the evening orbit alone', () => {
    expect(watchCandidate(objects, nullCheck)).toBe('way/sinks')
  })

  it('never picks a bridge, a structure that passed or nearly passed the check, or one within the 95% band', () => {
    const tight = { ...nullCheck, z_p95: { '28': 2.9, '123': 5 } }
    expect(watchCandidate(objects, tight)).toBeNull()
  })

  it('needs the open-ground check', () => {
    expect(watchCandidate(objects, null)).toBeNull()
  })

  it('finds the sinking building in tonight data and nothing else', () => {
    if (real.objects === null) throw new Error('no objects')
    expect(watchCandidate(real.objects, real.nullCheck)).toBe('way/359422657')
  })
})

describe('eveningPopulation', () => {
  it('counts buildings with an evening slope, those towards the satellite when warm, and their open-ground labels', () => {
    expect(eveningPopulation(objects, nullCheck)).toEqual({ towards: 4, total: 6, noise: 4 })
  })

  it('leaves the open-ground counts unknown without the check', () => {
    expect(eveningPopulation(objects, null)).toEqual({ towards: 4, total: 6, noise: null })
  })

  it('has no population without an evening series', () => {
    const tracks = Object.fromEntries(
      Object.entries(objects.tracks).filter(([, t]) => t.direction === 'ASCENDING'),
    )
    expect(eveningPopulation({ ...objects, tracks }, nullCheck)).toBeNull()
  })

  it('counts the signs of the temperature-only evening slopes in objects.json', () => {
    if (real.objects === null) throw new Error('no objects')
    expect(eveningPopulation(real.objects, real.nullCheck)).toEqual({
      towards: 74,
      total: 105,
      noise: 103,
    })
  })
})

describe('earlyResult', () => {
  it('takes passes per orbit from the check and the months from the evening series', () => {
    expect(earlyResult(place())).toEqual({ passes: 9, months: 4 })
    expect(earlyResult(place({ nullCheck: null }))).toEqual({ passes: 3, months: 4 })
    expect(earlyResult(place({ objects: null }))).toBeNull()
  })
})

describe('businessRows', () => {
  it('pins the watch candidate, then orders by status, known names and size', () => {
    expect(businessRows(place(), null).map((r) => [r.object.osm, r.pin, r.label])).toEqual([
      ['way/sinks', 'watch', 'like_open_ground'],
      ['way/clear', null, 'beats_all'],
      ['way/edge', null, 'borderline'],
      ['way/named', null, 'like_open_ground'],
      ['way/big', null, 'like_open_ground'],
      ['way/bridge', null, 'like_open_ground'],
      ['way/none', null, 'like_open_ground'],
      ['way/sinks-less', null, 'like_open_ground'],
    ])
  })

  it('puts the story building first and the watch candidate second on tonight data', () => {
    const rows = businessRows(real, buildStory(real))
    expect(rows.slice(0, 2).map((r) => [r.object.osm, r.pin])).toEqual([
      ['way/359317018', 'story'],
      ['way/359422657', 'watch'],
    ])
    expect(rows).toHaveLength(145)
    expect(rows[0]?.range).toMatchObject({ loMm: 4, hiMm: 5, passes: 9 })
  })

  it('takes every number of a row from the evening orbit', () => {
    const [first] = businessRows(real, buildStory(real))
    expect(first?.heat.evening?.track).toBe(123)
    expect(first?.range?.mmPerC).toBe(0.302)
  })
})
