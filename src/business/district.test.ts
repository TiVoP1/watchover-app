import type { LineString, Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import {
  COLOUR_SCALE_MM_PER_C,
  districtBounds,
  districtColour,
  districtGeojson,
  districtHeights,
  districtTint,
  HEIGHT_CAP_MM,
  HEIGHT_M_PER_MM,
  heightsLine,
  heightsSource,
  heightsState,
  MIN_HEIGHT_M,
  NEUTRAL_HEIGHT_M,
} from '#web/business/district.ts'
import { eveningPopulation } from '#web/business/motion.ts'
import { isNullCheck } from '#web/data/load.ts'
import type {
  MotionObject,
  NullCheck,
  NullLabel,
  ObjectFootprints,
  ObjectTrack,
  Objects,
  TrackSeries,
} from '#web/data/types.ts'
import { COLOR, LOS_RAMP } from '#web/tokens.ts'

const files = import.meta.glob<unknown>(
  '/public/data/stalowa-wola/insar/{objects.json,null_check.json,objects.geojson}',
  { eager: true, import: 'default', query: '?raw' },
)

const realFile = (name: string): unknown => {
  const raw = files[`/public/data/stalowa-wola/insar/${name}`]
  return typeof raw === 'string' ? (JSON.parse(raw) as unknown) : null
}

const ZONE = 'Europe/Warsaw'

const track = (los_mm: readonly number[], mm_per_c: number | null = null): ObjectTrack => ({
  coherence: 0.8,
  los_mm,
  mm_per_c,
  mm_per_c_err: mm_per_c === null ? null : 0.05,
  resid_mm: 1,
  hot_cold_mm: null,
  hot_cold_err_mm: null,
})

const object = (
  osm: string,
  kind: MotionObject['kind'],
  lon: number,
  dusk: ObjectTrack,
): MotionObject => ({
  osm,
  kind,
  name: null,
  area_m2: 10_000,
  lon,
  lat: 50.55,
  tracks: { '28A': track([0, 1, 2], 0.9), '123D': dusk },
  vertical_consistent: true,
  mm_per_c: 0.9,
  mm_per_c_err: 0.01,
})

const DAWN: TrackSeries = {
  track: 28,
  direction: 'ASCENDING',
  passes: ['2026-06-28T03:13:39Z', '2026-07-10T03:13:38Z', '2026-07-22T03:13:37Z'],
  scenes: ['a0', 'a1', 'a2'],
  temperature_c: [14, 9, 3],
  hot_pass: 0,
  cold_pass: 2,
}

const DUSK: TrackSeries = {
  track: 123,
  direction: 'DESCENDING',
  passes: ['2026-06-22T17:43:22Z', '2026-07-04T17:43:21Z', '2026-07-16T17:43:20Z'],
  scenes: ['d0', 'd1', 'd2'],
  temperature_c: [23, 27, 11],
  hot_pass: 1,
  cold_pass: 2,
}

const objects: Objects = {
  crid: 'P05023',
  level: 'GSLC',
  los_sign_verified: true,
  temperature_estimate: true,
  attribution: '',
  tracks: { '28A': DAWN, '123D': DUSK },
  objects: [
    object('way/1', 'building', 22.05, track([0, 20, -3], 0.3)),
    object('way/2', 'building', 22.06, track([0, 9, 1], 0.01)),
    object('way/3', 'building', 22.07, track([0, -2, 0], -0.3)),
    object('way/4', 'building', 22.08, track([0, -2, 0], 0.3)),
    object('way/5', 'building', 22.09, track([0, -5, 1], -0.3)),
    object('way/6', 'bridge', 22.1, track([0, 0, 0], -0.4)),
    object('way/7', 'building', 22.11, track([0, 0, 0])),
  ],
}

const checked = (osm: string, label: NullLabel, z: number) => ({
  osm,
  z: { '28': 0.5, '123': z },
  squares_same_direction: label === 'beats_all' ? 0 : 5,
  squares_any_direction: 5,
  label,
})

const NULL_CHECK: NullCheck = {
  method: {},
  generated_from: [],
  passes_per_track: 3,
  seed: 1,
  squares_coherent_both: 100,
  same_sign_share: 0.5,
  both_beyond_2_same_sign_share: 0.02,
  z_p95: { '28': 2.9, '123': 2.9 },
  t_expected_p95: 2.36,
  error_inflation: 1.2,
  histogram: { bin_edges: [], counts: [] },
  objects: [
    checked('way/1', 'beats_all', 6),
    checked('way/2', 'borderline', 3),
    checked('way/3', 'like_open_ground', -5),
    checked('way/4', 'like_open_ground', 1),
    checked('way/5', 'beats_all', -6),
    checked('way/6', 'like_open_ground', -8),
    checked('way/7', 'beats_all', 7),
  ],
  temperature_estimate: true,
  source: '',
}

const square = (lon: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [lon, 50.55],
      [lon + 0.001, 50.55],
      [lon + 0.001, 50.551],
      [lon, 50.551],
      [lon, 50.55],
    ],
  ],
})

const line = (lon: number): LineString => ({
  type: 'LineString',
  coordinates: [
    [lon, 50.55],
    [lon + 0.01, 50.55],
  ],
})

const footprints: ObjectFootprints = {
  type: 'FeatureCollection',
  attribution: '',
  temperature_estimate: true,
  features: objects.objects.map((o) => ({
    type: 'Feature',
    geometry: o.osm === 'way/4' ? line(o.lon) : square(o.lon),
    properties: {
      osm: o.osm,
      name: null,
      kind: o.kind,
      area_m2: o.area_m2,
      mm_per_c: o.mm_per_c,
      mm_per_c_err: o.mm_per_c_err,
      mm_per_c_track: null,
      vertical_consistent: o.vertical_consistent,
      coherence: 0.8,
    },
  })),
}

const district = districtGeojson(footprints, objects, NULL_CHECK)

const stateAt = (time: string) => {
  const state = heightsState(objects, time)
  if (state === null) throw new Error('no passes')
  return state
}

const heightsAt = (time: string) => districtHeights(district, objects, stateAt(time))

const expectHeights = (time: string, expected: Readonly<Record<string, number>>) => {
  const heights = heightsAt(time)
  expect([...heights.keys()]).toEqual(Object.keys(expected))
  for (const [osm, mm] of Object.entries(expected)) expect(heights.get(osm)).toBeCloseTo(mm, 9)
}

const FLOOR_MM = -(NEUTRAL_HEIGHT_M - MIN_HEIGHT_M) / HEIGHT_M_PER_MM

describe('districtTint', () => {
  it('paints the evening slope on the berlin map for a clear structure', () => {
    expect(districtTint(COLOUR_SCALE_MM_PER_C, 'beats_all')).toBe(LOS_RAMP[8])
    expect(districtTint(-COLOUR_SCALE_MM_PER_C, 'beats_all')).toBe(LOS_RAMP[0])
    expect(districtTint(0, 'beats_all')).toBe(LOS_RAMP[4])
    expect(districtTint(2, 'beats_all')).toBe(LOS_RAMP[8])
    expect(districtTint(null, 'beats_all')).toBe(LOS_RAMP[4])
  })

  it('keeps every structure that is not clear grey, however steep its slope', () => {
    for (const label of ['borderline', 'like_open_ground', null] as const) {
      expect(districtTint(COLOUR_SCALE_MM_PER_C, label)).toBe(COLOR.control)
      expect(districtTint(-7, label)).toBe(COLOR.control)
    }
  })
})

describe('districtGeojson', () => {
  it('draws every building polygon with its evening slope, never a bridge or a line', () => {
    const clear = (osm: string, eveningMmPerC: number | null) => ({
      osm,
      clear: true,
      watch: false,
      eveningMmPerC,
      colour: districtTint(eveningMmPerC, 'beats_all'),
    })
    expect(district.features.map((f) => f.properties)).toEqual([
      clear('way/1', 0.3),
      { osm: 'way/2', clear: false, watch: false, eveningMmPerC: 0.01, colour: COLOR.control },
      { osm: 'way/3', clear: false, watch: true, eveningMmPerC: -0.3, colour: COLOR.control },
      clear('way/5', -0.3),
      clear('way/7', null),
    ])
  })

  it('keeps every block grey and unmarked without the open-ground check', () => {
    const plain = districtGeojson(footprints, objects, null)
    expect(plain.features.some((f) => f.properties.clear || f.properties.watch)).toBe(false)
    expect(plain.features.every((f) => f.properties.colour === COLOR.control)).toBe(true)
    expect(plain.features).toHaveLength(5)
  })

  it('takes the slope from the evening orbit, not the value combined over both orbits', () => {
    const real = realFile('objects.json') as Objects
    const geojson = realFile('objects.geojson') as ObjectFootprints
    const checked = realFile('null_check.json')
    const realDistrict = districtGeojson(geojson, real, isNullCheck(checked) ? checked : null)
    const hall = realDistrict.features.find((f) => f.properties.osm === 'way/359317018')
    expect(hall?.properties).toMatchObject({ clear: true, eveningMmPerC: 0.302 })
    expect(realDistrict.features).toHaveLength(
      eveningPopulation(real, isNullCheck(checked) ? checked : null)?.total ?? -1,
    )
    expect(realDistrict.features.filter((f) => f.properties.clear)).toHaveLength(1)
  })
})

describe('districtColour', () => {
  it('keeps clear structures in their own colour, then whitens the selected block, then the watch candidate', () => {
    expect(districtColour('way/3')).toEqual([
      'case',
      ['==', ['get', 'clear'], true],
      ['get', 'colour'],
      ['==', ['get', 'osm'], 'way/3'],
      COLOR.text,
      ['==', ['get', 'watch'], true],
      COLOR.text2,
      COLOR.control,
    ])
    expect(districtColour(null)[3]).toEqual(['==', ['get', 'osm'], ''])
  })
})

describe('heightsState', () => {
  it('names the latest evening pass at or before the frame and the coldest evening pass', () => {
    expect(stateAt('2026-06-01T00:00:00Z')).toEqual({
      kind: 'before',
      pass: { key: '123D', index: 0, time: '2026-06-22T17:43:22Z', track: 123 },
      coldest: '2026-07-16T17:43:20Z',
    })
    expect(stateAt('2026-07-10T12:00:00Z')).toMatchObject({
      kind: 'during',
      pass: { key: '123D', index: 1 },
    })
    expect(stateAt('2026-07-16T17:43:20Z')).toMatchObject({
      kind: 'during',
      pass: { key: '123D', index: 2 },
    })
    expect(stateAt('2026-08-01T00:00:00Z')).toMatchObject({
      kind: 'after',
      pass: { key: '123D', index: 2 },
    })
  })

  it('ignores the dawn orbit', () => {
    expect(stateAt('2026-07-22T03:13:37Z')).toMatchObject({
      kind: 'after',
      pass: { key: '123D', index: 2 },
    })
    expect(heightsState({ ...objects, tracks: { '28A': DAWN } }, '2026-07-01T00:00:00Z')).toBeNull()
    expect(heightsState({ ...objects, tracks: {} }, '2026-07-01T00:00:00Z')).toBeNull()
  })
})

describe('districtHeights', () => {
  it('moves only a clear block, by its evening slope times the warmth above the coldest evening', () => {
    expectHeights('2026-06-30T00:00:00Z', {
      'way/1': 0.3 * 12,
      'way/2': 0,
      'way/3': 0,
      'way/5': FLOOR_MM,
      'way/7': 0,
    })
    expectHeights('2026-07-10T00:00:00Z', {
      'way/1': 0.3 * 16,
      'way/2': 0,
      'way/3': 0,
      'way/5': FLOOR_MM,
      'way/7': 0,
    })
  })

  it('settles every block at its base height on the coldest evening and before the series', () => {
    for (const time of ['2026-06-01T00:00:00Z', '2026-08-01T00:00:00Z']) {
      expectHeights(time, { 'way/1': 0, 'way/2': 0, 'way/3': 0, 'way/5': 0, 'way/7': 0 })
    }
  })

  it('keeps the watch candidate at its base height, never sinking it in the heat', () => {
    expect(heightsAt('2026-07-10T00:00:00Z').get('way/3')).toBe(0)
  })

  it('caps a steep slope and keeps a sinking block above the ground', () => {
    const steep = {
      ...district,
      features: district.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          clear: true,
          eveningMmPerC: f.properties.osm === 'way/1' ? 7 : -7,
        },
      })),
    }
    const heights = districtHeights(steep, objects, stateAt('2026-07-10T00:00:00Z'))
    expect(heights.get('way/1')).toBe(HEIGHT_CAP_MM)
    expect(heights.get('way/2')).toBe(FLOOR_MM)
    expect(NEUTRAL_HEIGHT_M + FLOOR_MM * HEIGHT_M_PER_MM).toBeCloseTo(MIN_HEIGHT_M, 9)
  })
})

describe('heightsLine', () => {
  it('says how much the heights are exaggerated and that the motion is along the line of sight', () => {
    expect(heightsLine(stateAt('2026-07-10T00:00:00Z'), ZONE)).toBe(
      "Height drawn 20,000x larger; motion is along the radar's line of sight.",
    )
  })

  it('says the blocks stand still before the evening series, on the local date', () => {
    expect(heightsLine(stateAt('2026-06-01T00:00:00Z'), ZONE)).toBe(
      'Blocks stand at their base height until 22 Jun 2026.',
    )
  })
})

describe('heightsSource', () => {
  it('labels the heights as an estimate and traces them to the evening pass, in UTC', () => {
    expect(heightsSource(objects, '2026-07-10T12:00:00Z')).toBe(
      'heights: estimate, track 123 descending, 4 Jul 2026, 17:43 UTC',
    )
    expect(heightsSource(objects, '2026-08-01T00:00:00Z')).toBe(
      'heights: estimate, track 123 descending, 16 Jul 2026, 17:43 UTC',
    )
  })

  it('names no heights while the blocks stand at their base height', () => {
    expect(heightsSource(objects, '2026-06-01T00:00:00Z')).toBeNull()
    expect(
      heightsSource({ ...objects, tracks: { '28A': DAWN } }, '2026-07-10T00:00:00Z'),
    ).toBeNull()
  })
})

describe('districtBounds', () => {
  it('frames the clear structures and the watch candidate', () => {
    const bounds = districtBounds(district, objects)
    if (bounds === null) throw new Error('no bounds')
    const [[west, south], [east, north]] = bounds
    expect((west + east) / 2).toBeCloseTo(22.08, 6)
    expect((south + north) / 2).toBeCloseTo(50.55, 6)
    expect(north - south).toBeCloseTo(2000 / 110_540, 6)
  })

  it('grows to keep a watch candidate far from the clear structures in view', () => {
    const far = {
      ...objects,
      objects: objects.objects.map((o) => (o.osm === 'way/3' ? { ...o, lat: 50.6 } : o)),
    }
    const bounds = districtBounds(district, far)
    if (bounds === null) throw new Error('no bounds')
    const [[, south], [, north]] = bounds
    expect(south).toBeLessThan(50.55)
    expect(north).toBeGreaterThan(50.6)
  })

  it('has no bounds when nothing is clear and nothing is watched', () => {
    expect(districtBounds({ type: 'FeatureCollection', features: [] }, objects)).toBeNull()
  })
})
