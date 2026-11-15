import type { Polygon } from 'geojson'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { BBox, Catalog, Corners, Direction } from '#web/data/types.ts'
import type { Mode, Panel } from '#web/state/store.ts'
import { paddedBBox } from '#web/story/crop.ts'
import type { LonLat } from '#web/story/where.ts'
import { COLOR } from '#web/tokens.ts'

export type ZoomBand = readonly [from: number, to: number]
export type Bounds = [[west: number, south: number], [east: number, north: number]]

export const NIGHT_ZOOM: ZoomBand = [4, 5.5]
export const PLACE_ZOOM: ZoomBand = [7, 8.5]
/** Only the flat Mercator range keeps minZoom unadjusted, so applyLimits never sets it below FLAT_ZOOM[1]. */
export const FLAT_ZOOM: ZoomBand = [7, 9]
const TILE_PX = 512
export const ARC_CURVE = 2.5

export const EDGE_PX = 24
export const LABEL_CLEARANCE_PX = 40
export const PLATE_CLEARANCE_PX = 72
export const DISTRICT_PLATE_CLEARANCE_PX = 88
export const INSET_MAX_SHARE = 0.3
export const INSET_GAP_PX = 32
export const DISTRICT_PITCH_DEG = 45

export const ORBIT_STYLE: Pick<StyleSpecification, 'projection' | 'sky'> = {
  projection: {
    type: [
      'interpolate',
      ['linear'],
      ['zoom'],
      FLAT_ZOOM[0],
      'vertical-perspective',
      FLAT_ZOOM[1],
      'mercator',
    ],
  },
  sky: { 'atmosphere-blend': 0, 'sky-color': COLOR.bg, 'horizon-color': COLOR.bg },
}

export const fadeIn = ([from, to]: ZoomBand, max = 1): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  from,
  0,
  to,
  max,
]

export const fadeOut = ([from, to]: ZoomBand): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  from,
  1,
  to,
  0,
]

export const fromNight = (colour: string): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  NIGHT_ZOOM[0],
  COLOR.radarLo,
  NIGHT_ZOOM[1],
  colour,
]

export interface Swath {
  readonly time: string
  readonly track: number
  readonly direction: Direction
  readonly seen: string
  readonly footprint: Polygon
  readonly projected: boolean
}

export function nextSwath(catalog: Catalog, nowMs: number): Swath | null {
  const pass = catalog.schedule.upcoming.find((p) => new Date(p.time).getTime() > nowMs)
  if (pass === undefined) return null
  const last = catalog.schedule.tracks.find(
    (t) => t.track === pass.track && t.direction === pass.direction,
  )
  if (last === undefined) return null
  const { time, track, direction } = pass
  return {
    time,
    track,
    direction,
    seen: last.last,
    footprint: last.footprint,
    projected: pass.projected,
  }
}

export function orbitZoom(widthPx: number, heightPx: number, latDeg: number): number {
  const radiusPx = Math.min(widthPx, heightPx) / 2
  return Math.log2((2 * Math.PI * radiusPx * Math.cos((latDeg * Math.PI) / 180)) / TILE_PX)
}

export function boundsOf(points: readonly (readonly [number, number])[]): Bounds {
  const lons = points.map(([lon]) => lon)
  const lats = points.map(([, lat]) => lat)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

export interface Padding {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export type Shot =
  | { readonly kind: 'globe'; readonly center: LonLat; readonly zoom: number }
  | {
      readonly kind: 'bounds'
      readonly bounds: Bounds
      readonly padding: Padding
      readonly pitch: number
    }

export interface CameraTarget {
  readonly key: string
  readonly shot: Shot
  readonly placeView: boolean
  readonly limits: boolean
}

export interface TargetInput {
  readonly slug: string
  readonly centre: LonLat
  readonly corners: Corners | null
  readonly panel: Panel
  readonly mode: Mode
  readonly focus: { readonly id: string; readonly bbox: BBox } | null
  readonly district: Bounds | null
  readonly inset: boolean
  readonly widthPx: number
  readonly heightPx: number
}

const bboxBounds = ([west, south, east, north]: BBox): Bounds => [
  [west, south],
  [east, north],
]

export function cameraTarget(input: TargetInput): CameraTarget {
  const { slug, corners } = input
  if (input.panel === 'orbit' || corners === null) {
    const zoom = orbitZoom(input.widthPx, input.heightPx, input.centre[1])
    const shot: Shot = { kind: 'globe', center: input.centre, zoom }
    return { key: `globe:${slug}`, shot, placeView: false, limits: false }
  }
  if (input.mode === 'business' && input.district !== null) {
    const padding = {
      top: EDGE_PX,
      right: EDGE_PX,
      bottom: DISTRICT_PLATE_CLEARANCE_PX,
      left: EDGE_PX,
    }
    const shot: Shot = {
      kind: 'bounds',
      bounds: input.district,
      padding,
      pitch: DISTRICT_PITCH_DEG,
    }
    return { key: `district:${slug}`, shot, placeView: true, limits: false }
  }
  const framed = { top: LABEL_CLEARANCE_PX, bottom: PLATE_CLEARANCE_PX, left: EDGE_PX }
  if (input.focus !== null) {
    const bounds = bboxBounds(paddedBBox(input.focus.bbox))
    const shot: Shot = { kind: 'bounds', bounds, padding: { ...framed, right: EDGE_PX }, pitch: 0 }
    return { key: `card:${input.focus.id}`, shot, placeView: true, limits: true }
  }
  const right = input.inset ? Math.round(input.widthPx * INSET_MAX_SHARE) + INSET_GAP_PX : EDGE_PX
  const shot: Shot = {
    kind: 'bounds',
    bounds: boundsOf(corners),
    padding: { ...framed, right },
    pitch: 0,
  }
  return { key: `window:${slug}`, shot, placeView: true, limits: true }
}

export type CameraMove = 'jump' | 'arc' | 'fly'

export function cameraMove(
  previous: CameraTarget | null,
  next: CameraTarget,
  playing: boolean,
): CameraMove {
  if (previous === null) return 'jump'
  if (previous.placeView !== next.placeView) return 'arc'
  return playing ? 'jump' : 'fly'
}

export type MapStatus = 'loading' | 'orbit' | 'moving' | 'ready'

export interface StatusInput {
  readonly mapReady: boolean
  readonly placeReady: boolean
  readonly globe: boolean
  readonly moving: boolean
  readonly idle: boolean
  readonly wantedUrl: string | null
  readonly drawnUrl: string | null
}

export function mapStatus(s: StatusInput): MapStatus {
  if (!s.mapReady || !s.placeReady) return 'loading'
  if (s.moving) return 'moving'
  if (!s.idle) return 'loading'
  if (s.globe) return 'orbit'
  return s.wantedUrl !== null && s.wantedUrl !== s.drawnUrl ? 'loading' : 'ready'
}
