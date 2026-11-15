import type { Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { BBox, Catalog, ProjectedPass, TrackFootprint } from '#web/data/types.ts'
import {
  boundsOf,
  type CameraTarget,
  cameraMove,
  cameraTarget,
  EDGE_PX,
  INSET_GAP_PX,
  INSET_MAX_SHARE,
  mapStatus,
  nextSwath,
  orbitZoom,
  type StatusInput,
  type TargetInput,
} from '#web/map/orbit.ts'

const footprint: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [21.0, 48.59],
      [26.11, 49.2],
      [25.4, 51.99],
      [20.71, 51.38],
      [21.0, 48.59],
    ],
  ],
}

const track28: TrackFootprint = {
  track: 28,
  direction: 'ASCENDING',
  frame: 27,
  footprint,
  last: '2026-10-26T03:13:36+00:00',
}

const pass = (track: number, time: string): ProjectedPass => ({
  track,
  direction: 'ASCENDING',
  time,
  projected: true,
})

const catalog = (
  upcoming: readonly ProjectedPass[],
  tracks: readonly TrackFootprint[] = [track28],
): Catalog => ({
  place: { slug: 'stalowa-wola', name: 'Stalowa Wola', country: 'Poland', lat: 50.58, lon: 22.05 },
  counts: { GCOV: 1, GSLC: 1, GUNW: 0, SME2: 0 },
  schedule: { tracks, pending: [], upcoming },
})

const corners = [
  [21.8, 50.72],
  [22.3, 50.72],
  [22.3, 50.44],
  [21.8, 50.44],
] as const

const NOW_MS = Date.parse('2026-11-14T15:00:00Z')

describe('nextSwath', () => {
  const upcoming = [pass(129, '2026-11-14T03:21:55Z'), pass(28, '2026-11-19T03:13:36Z')]

  it('takes the first pass after now and the footprint its track last had', () => {
    expect(nextSwath(catalog(upcoming), NOW_MS)).toEqual({
      time: '2026-11-19T03:13:36Z',
      track: 28,
      direction: 'ASCENDING',
      seen: '2026-10-26T03:13:36+00:00',
      footprint,
      projected: true,
    })
  })

  it('has nothing to show when every pass is in the past', () => {
    expect(nextSwath(catalog(upcoming), Date.parse('2026-12-01T00:00:00Z'))).toBeNull()
  })

  it('has nothing to show when the track of the next pass has no footprint', () => {
    const descending = { ...track28, direction: 'DESCENDING' } as const
    expect(nextSwath(catalog(upcoming, [descending]), NOW_MS)).toBeNull()
  })
})

describe('orbitZoom', () => {
  const globeRadiusPx = (zoom: number, latDeg: number) =>
    (512 * 2 ** zoom) / (2 * Math.PI * Math.cos((latDeg * Math.PI) / 180))

  it('draws the same globe for places at different latitudes', () => {
    expect(globeRadiusPx(orbitZoom(1552, 868, 50.58), 50.58)).toBeCloseTo(434, 6)
    expect(globeRadiusPx(orbitZoom(1552, 868, 19.43), 19.43)).toBeCloseTo(434, 6)
  })
})

describe('boundsOf', () => {
  it('spans the corners', () => {
    expect(boundsOf(corners)).toEqual([
      [21.8, 50.44],
      [22.3, 50.72],
    ])
  })
})

describe('cameraTarget', () => {
  const bbox: BBox = [22.0, 50.55, 22.01, 50.56]
  const input: TargetInput = {
    slug: 'stalowa-wola',
    centre: [22.05, 50.58],
    corners,
    panel: 'rest',
    mode: 'people',
    focus: null,
    district: null,
    inset: true,
    widthPx: 1552,
    heightPx: 868,
  }

  it('waits on the globe above the place until the place is entered', () => {
    const target = cameraTarget({ ...input, panel: 'orbit' })
    expect(target.key).toBe('globe:stalowa-wola')
    expect(target.shot).toEqual({
      kind: 'globe',
      center: [22.05, 50.58],
      zoom: orbitZoom(1552, 868, 50.58),
    })
    expect(target.placeView).toBe(false)
    expect(target.limits).toBe(false)
  })

  it('stays on the globe for a place without radar', () => {
    expect(cameraTarget({ ...input, corners: null }).shot.kind).toBe('globe')
  })

  it('frames the watched area with the right side free for the Play inset', () => {
    const target = cameraTarget(input)
    expect(target.key).toBe('window:stalowa-wola')
    expect(target.limits).toBe(true)
    if (target.shot.kind !== 'bounds') throw new Error('expected a bounds shot')
    expect(target.shot.bounds).toEqual(boundsOf(corners))
    expect(target.shot.padding.right).toBe(Math.round(1552 * INSET_MAX_SHARE) + INSET_GAP_PX)
    expect(target.shot.pitch).toBe(0)
  })

  it('keeps the frame centred for a place without Play stops', () => {
    const target = cameraTarget({ ...input, inset: false })
    if (target.shot.kind !== 'bounds') throw new Error('expected a bounds shot')
    expect(target.shot.padding.right).toBe(EDGE_PX)
  })

  it('flies to an open change with at least 1.5 km of ground around it', () => {
    const target = cameraTarget({ ...input, panel: 'story', focus: { id: 'forest-a', bbox } })
    expect(target.key).toBe('card:forest-a')
    if (target.shot.kind !== 'bounds') throw new Error('expected a bounds shot')
    const [[west, south], [east, north]] = target.shot.bounds
    expect(west).toBeLessThan(bbox[0])
    expect(east).toBeGreaterThan(bbox[2])
    expect(north - south).toBeGreaterThan((1.5 / 111.32) * 0.99)
  })

  it('tilts to the district in Business and drops the watched-area limits there', () => {
    const district = boundsOf([
      [22.0, 50.55],
      [22.1, 50.6],
    ])
    const target = cameraTarget({ ...input, mode: 'business', district, focus: null })
    expect(target.key).toBe('district:stalowa-wola')
    expect(target.limits).toBe(false)
    if (target.shot.kind !== 'bounds') throw new Error('expected a bounds shot')
    expect(target.shot.pitch).toBeGreaterThan(0)
  })
})

describe('cameraMove', () => {
  const at = (key: string, placeView: boolean): CameraTarget => ({
    key,
    placeView,
    limits: placeView,
    shot: { kind: 'globe', center: [0, 0], zoom: 1 },
  })

  it('jumps to the first framing, so a link to a stop never shows the dive', () => {
    expect(cameraMove(null, at('window:a', true), false)).toBe('jump')
  })

  it('arcs between the globe and the place in both directions', () => {
    expect(cameraMove(at('globe:a', false), at('window:a', true), false)).toBe('arc')
    expect(cameraMove(at('window:a', true), at('globe:a', false), false)).toBe('arc')
  })

  it('flies inside the place but keeps the camera still once Play runs', () => {
    expect(cameraMove(at('window:a', true), at('card:x', true), false)).toBe('fly')
    expect(cameraMove(at('card:x', true), at('window:a', true), true)).toBe('jump')
  })
})

describe('mapStatus', () => {
  const settled: StatusInput = {
    mapReady: true,
    placeReady: true,
    globe: false,
    moving: false,
    idle: true,
    wantedUrl: '/data/a.webp',
    drawnUrl: '/data/a.webp',
  }

  it('is ready only when the asked-for radar image is on screen and the map is idle', () => {
    expect(mapStatus(settled)).toBe('ready')
    expect(mapStatus({ ...settled, drawnUrl: '/data/b.webp' })).toBe('loading')
    expect(mapStatus({ ...settled, idle: false })).toBe('loading')
  })

  it('reports the camera in flight and the waiting globe', () => {
    expect(mapStatus({ ...settled, moving: true })).toBe('moving')
    expect(mapStatus({ ...settled, globe: true, drawnUrl: null })).toBe('orbit')
  })

  it('is loading until the map and the place both exist', () => {
    expect(mapStatus({ ...settled, mapReady: false })).toBe('loading')
    expect(mapStatus({ ...settled, placeReady: false })).toBe('loading')
  })
})
