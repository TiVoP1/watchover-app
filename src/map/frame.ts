import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson'
import type { Corners } from '#web/data/types.ts'
import { insideRing } from '#web/film/geo.ts'
import { type Bounds, boundsOf } from '#web/map/orbit.ts'
import { groundSizeM } from '#web/story/crop.ts'
import type { LonLat } from '#web/story/where.ts'

export const FOG_OPACITY = [0.45, 0.7, 0.88] as const
export const CENTRE_REACH_SQUARES = 0.5
export const MIN_VIEW_SHARE = 1 / 3

const WORLD_LON_DEG = 180
const WORLD_LAT_DEG = 85
const EQUATOR_M = 40_075_016.686
const TILE_PX = 512
const RAD = Math.PI / 180

export interface FogProps {
  readonly ring: 1 | 2 | 3
  readonly opacity: number
}

export interface NeighbourProps {
  readonly east: number
  readonly north: number
}

export interface ViewPx {
  readonly width: number
  readonly height: number
}

export function gridPoint(corners: Corners, east: number, south: number): LonLat {
  const [nw, ne, se, sw] = corners
  const weights = [
    (1 - east) * (1 - south),
    east * (1 - south),
    east * south,
    (1 - east) * south,
  ] as const
  return [
    weights[0] * nw[0] + weights[1] * ne[0] + weights[2] * se[0] + weights[3] * sw[0],
    weights[0] * nw[1] + weights[1] * ne[1] + weights[2] * se[1] + weights[3] * sw[1],
  ]
}

export const windowCentre = (corners: Corners): LonLat => gridPoint(corners, 0.5, 0.5)

const position = ([lon, lat]: LonLat): Position => [lon, lat]

function squareRing(corners: Corners, east: number, south: number, size: number): Position[] {
  const northWest = position(gridPoint(corners, east, south))
  return [
    northWest,
    position(gridPoint(corners, east, south + size)),
    position(gridPoint(corners, east + size, south + size)),
    position(gridPoint(corners, east + size, south)),
    northWest,
  ]
}

const clockwise = (ring: readonly Position[]): Position[] => [...ring].reverse()

const WORLD_RING: Position[] = [
  [-WORLD_LON_DEG, WORLD_LAT_DEG],
  [-WORLD_LON_DEG, -WORLD_LAT_DEG],
  [WORLD_LON_DEG, -WORLD_LAT_DEG],
  [WORLD_LON_DEG, WORLD_LAT_DEG],
  [-WORLD_LON_DEG, WORLD_LAT_DEG],
]

export function frameOutline(corners: Corners): Feature<LineString> {
  const [nw, ne, se, sw] = corners
  const coordinates = [nw, ne, se, sw, nw].map(position)
  return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }
}

export const windowSquare = (corners: Corners): Feature<Polygon> => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [squareRing(corners, 0, 0, 1)] },
  properties: {},
})

export type LabelAnchor = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export interface LabelSpot {
  readonly lonLat: LonLat
  readonly anchor: LabelAnchor
}

export interface ScreenXY {
  readonly x: number
  readonly y: number
}

const LABEL_SPOTS: readonly { readonly corner: 0 | 1 | 2 | 3; readonly anchor: LabelAnchor }[] = [
  { corner: 0, anchor: 'bottom-left' },
  { corner: 1, anchor: 'bottom-right' },
  { corner: 3, anchor: 'top-left' },
  { corner: 2, anchor: 'top-right' },
]

export function frameLabelSpot(
  corners: Corners,
  project: (lonLat: LonLat) => ScreenXY,
  view: ViewPx,
  label: ViewPx,
  gapPx: number,
): LabelSpot | null {
  for (const { corner, anchor } of LABEL_SPOTS) {
    const lonLat = corners[corner]
    const at = project(lonLat)
    const left = anchor.endsWith('left') ? at.x : at.x - label.width
    const top = anchor.startsWith('bottom') ? at.y - gapPx - label.height : at.y + gapPx
    const inside =
      left >= gapPx &&
      top >= gapPx &&
      left + label.width <= view.width - gapPx &&
      top + label.height <= view.height - gapPx
    if (inside) return { lonLat, anchor }
  }
  return null
}

export function neighbourSquares(corners: Corners): FeatureCollection<Polygon, NeighbourProps> {
  const steps = [-1, 0, 1]
  const features = steps.flatMap((north) =>
    steps
      .filter((east) => east !== 0 || north !== 0)
      .map((east): Feature<Polygon, NeighbourProps> => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [squareRing(corners, east, -north, 1)] },
        properties: { east, north },
      })),
  )
  return { type: 'FeatureCollection', features }
}

export function fogRings(corners: Corners): FeatureCollection<Polygon, FogProps> {
  const window = squareRing(corners, 0, 0, 1)
  const first = squareRing(corners, -1, -1, 3)
  const second = squareRing(corners, -2, -2, 5)
  const ring = (
    n: FogProps['ring'],
    opacity: number,
    outer: Position[],
    hole: Position[],
  ): Feature<Polygon, FogProps> => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [outer, clockwise(hole)] },
    properties: { ring: n, opacity },
  })
  const [near, middle, far] = FOG_OPACITY
  return {
    type: 'FeatureCollection',
    features: [
      ring(1, near, first, window),
      ring(2, middle, second, first),
      ring(3, far, WORLD_RING, second),
    ],
  }
}

export function centreBounds(corners: Corners): Bounds {
  const near = -CENTRE_REACH_SQUARES
  const far = 1 + CENTRE_REACH_SQUARES
  return boundsOf([
    gridPoint(corners, near, near),
    gridPoint(corners, far, near),
    gridPoint(corners, far, far),
    gridPoint(corners, near, far),
  ])
}

export function placeMinZoom(corners: Corners, view: ViewPx): number {
  const { widthM, heightM } = groundSizeM(corners)
  const [, lat] = windowCentre(corners)
  const metresPerPxAtZero = (EQUATOR_M * Math.cos(lat * RAD)) / TILE_PX
  const zoomFor = (groundM: number, viewPx: number) =>
    Math.log2((metresPerPxAtZero * viewPx * MIN_VIEW_SHARE) / groundM)
  return Math.max(zoomFor(widthM, view.width), zoomFor(heightM, view.height))
}

export const insideWatched = (corners: Corners, point: LonLat): boolean =>
  insideRing(point, corners)

export function clampToBounds([[west, south], [east, north]]: Bounds, [lon, lat]: LonLat): LonLat {
  return [Math.min(east, Math.max(west, lon)), Math.min(north, Math.max(south, lat))]
}
