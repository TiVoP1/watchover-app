import type { BBox, Corners } from '#web/data/types.ts'
import { type Affine, applyAffine, destination, distanceKm, fitAffine } from '#web/film/geo.ts'
import type { LonLat } from '#web/story/where.ts'

/** Share of an image: x and w across from the left edge, y and h down from the top edge, all 0-1. */
export interface UnitRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface PixelRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface CropOptions {
  readonly minSpanM: number
  readonly marginShare: number
  readonly aspect: number
}

export interface Crop {
  readonly crop: UnitRect
  readonly outline: UnitRect
}

export const DEFAULT_CROP: CropOptions = { minSpanM: 1500, marginShare: 0.5, aspect: 1 }

const M_PER_KM = 1000
const COMPASS_EAST_DEG = 90
const COMPASS_SOUTH_DEG = 180
const COMPASS_WEST_DEG = 270
const COMPASS_NORTH_DEG = 0

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export function imageAffine(corners: Corners): Affine {
  return fitAffine(corners, [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ])
}

export function groundSizeM(corners: Corners): {
  readonly widthM: number
  readonly heightM: number
} {
  const [topLeft, topRight, , bottomLeft] = corners
  return {
    widthM: distanceKm(topLeft, topRight) * M_PER_KM,
    heightM: distanceKm(topLeft, bottomLeft) * M_PER_KM,
  }
}

export function bboxRect(corners: Corners, [west, south, east, north]: BBox): UnitRect {
  const affine = imageAffine(corners)
  const points = (
    [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ] as const
  ).map((p) => applyAffine(affine, p))
  const us = points.map(([u]) => u)
  const vs = points.map(([, v]) => v)
  const x = Math.min(...us)
  const y = Math.min(...vs)
  return { x, y, w: Math.max(...us) - x, h: Math.max(...vs) - y }
}

export function clipToWindow(corners: Corners, [west, south, east, north]: BBox): BBox {
  const lons = corners.map(([lon]) => lon)
  const lats = corners.map(([, lat]) => lat)
  return [
    Math.max(west, Math.min(...lons)),
    Math.max(south, Math.min(...lats)),
    Math.min(east, Math.max(...lons)),
    Math.min(north, Math.max(...lats)),
  ]
}

function groundSpan(widthM: number, heightM: number, options: CropOptions) {
  const grow = 1 + 2 * options.marginShare
  const h = Math.max(
    heightM * grow,
    (widthM * grow) / options.aspect,
    options.minSpanM / Math.min(1, options.aspect),
  )
  return { w: h * options.aspect, h }
}

export function cropAround(
  corners: Corners,
  bbox: BBox,
  options: CropOptions = DEFAULT_CROP,
): Crop {
  const box = bboxRect(corners, bbox)
  const size = groundSizeM(corners)
  const span = groundSpan(box.w * size.widthM, box.h * size.heightM, options)
  const fit = Math.min(1, size.widthM / span.w, size.heightM / span.h)
  const w = (span.w * fit) / size.widthM
  const h = (span.h * fit) / size.heightM
  const x = clamp(box.x + box.w / 2 - w / 2, 0, 1 - w)
  const y = clamp(box.y + box.h / 2 - h / 2, 0, 1 - h)
  return {
    crop: { x, y, w, h },
    outline: { x: (box.x - x) / w, y: (box.y - y) / h, w: box.w / w, h: box.h / h },
  }
}

export function squareBBox(centre: LonLat, areaM2: number): BBox {
  const halfKm = Math.sqrt(areaM2) / 2 / M_PER_KM
  const [west] = destination(centre, COMPASS_WEST_DEG, halfKm)
  const [east] = destination(centre, COMPASS_EAST_DEG, halfKm)
  const [, south] = destination(centre, COMPASS_SOUTH_DEG, halfKm)
  const [, north] = destination(centre, COMPASS_NORTH_DEG, halfKm)
  return [west, south, east, north]
}

export function paddedBBox(bbox: BBox, options: CropOptions = DEFAULT_CROP): BBox {
  const [west, south, east, north] = bbox
  const centre: LonLat = [(west + east) / 2, (south + north) / 2]
  const widthM = distanceKm([west, centre[1]], [east, centre[1]]) * M_PER_KM
  const heightM = distanceKm([centre[0], south], [centre[0], north]) * M_PER_KM
  const span = groundSpan(widthM, heightM, options)
  const halfW = span.w / 2 / M_PER_KM
  const halfH = span.h / 2 / M_PER_KM
  return [
    destination(centre, COMPASS_WEST_DEG, halfW)[0],
    destination(centre, COMPASS_SOUTH_DEG, halfH)[1],
    destination(centre, COMPASS_EAST_DEG, halfW)[0],
    destination(centre, COMPASS_NORTH_DEG, halfH)[1],
  ]
}
