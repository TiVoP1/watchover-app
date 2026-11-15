import type { BBox, Corners, PlaceData, RadarFrame } from '#web/data/types.ts'
import { applyAffine, fitAffine, type LonLat } from '#web/film/geo.ts'
import type { StoryItem } from '#web/story/chapters.ts'
import {
  type CropOptions,
  cropAround,
  groundSizeM,
  imageAffine,
  type UnitRect,
} from '#web/story/crop.ts'
import type { ChangeKind } from '#web/story/kinds.ts'

const CROP_MIN_SPAN_M = 12000
const CROP_MARGIN_SHARE = 0.5
const PERCENT = 100
const UNIT_SQUARE: readonly LonLat[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

export interface SplitImage {
  readonly path: string
  readonly crop: UnitRect
}

export interface CloudsPair {
  readonly photo: SplitImage
  readonly radar: SplitImage
  readonly outline: UnitRect | null
  readonly photoTime: string
  readonly cloudPct: number
  readonly kind: ChangeKind | null
  readonly pass: RadarFrame
  readonly pixelM: number
  readonly photoSource: string
}

const boxCorners = ([west, south, east, north]: BBox): Corners => [
  [west, north],
  [east, north],
  [east, south],
  [west, south],
]

export function coverCrop(aspect: number): UnitRect {
  if (aspect >= 1) return { x: 0, y: (1 - 1 / aspect) / 2, w: 1, h: 1 / aspect }
  return { x: (1 - aspect) / 2, y: 0, w: aspect, h: 1 }
}

export function sameGround(from: Corners, to: Corners, crop: UnitRect): UnitRect {
  const centre = applyAffine(fitAffine(UNIT_SQUARE, from), [
    crop.x + crop.w / 2,
    crop.y + crop.h / 2,
  ])
  const [u, v] = applyAffine(imageAffine(to), centre)
  const fromSize = groundSizeM(from)
  const toSize = groundSizeM(to)
  const w = (crop.w * fromSize.widthM) / toSize.widthM
  const h = (crop.h * fromSize.heightM) / toSize.heightM
  return { x: u - w / 2, y: v - h / 2, w, h }
}

function aroundChange(data: PlaceData, item: StoryItem, aspect: number): CloudsPair | null {
  const tile = item.clouds
  const { radar, clouds } = data
  if (tile === null || item.areaHa === null || radar === null || clouds === null) return null
  const pass = radar.frames.find((f) => f.frame === tile.radar.path)
  if (pass === undefined) return null
  const options: CropOptions = { minSpanM: CROP_MIN_SPAN_M, marginShare: CROP_MARGIN_SHARE, aspect }
  const { crop, outline } = cropAround(radar.corners_lonlat, item.bbox, options)
  const photoCrop = sameGround(radar.corners_lonlat, boxCorners(clouds.bbox_lonlat), crop)
  return {
    photo: { path: tile.optical.path, crop: photoCrop },
    radar: { path: tile.radar.path, crop },
    outline,
    photoTime: tile.optical.time,
    cloudPct: Math.round(tile.cloudShare * PERCENT),
    kind: item.kind,
    pass,
    pixelM: radar.pixel_m,
    photoSource: clouds.source,
  }
}

function wholeView(data: PlaceData, frame: number, aspect: number): CloudsPair | null {
  const { radar, clouds } = data
  const pass = radar?.frames[frame]
  const day =
    pass === undefined ? undefined : clouds?.days.find((d) => d.day === pass.time.slice(0, 10))
  if (radar === null || pass === undefined || clouds === null) return null
  if (day?.frame == null || day.cloud_fraction === null) return null
  const crop = coverCrop(aspect)
  return {
    photo: {
      path: day.frame,
      crop: sameGround(radar.corners_lonlat, boxCorners(clouds.bbox_lonlat), crop),
    },
    radar: { path: pass.frame, crop },
    outline: null,
    photoTime: `${day.day}T12:00:00Z`,
    cloudPct: Math.round(day.cloud_fraction * PERCENT),
    kind: null,
    pass,
    pixelM: radar.pixel_m,
    photoSource: clouds.source,
  }
}

export function cloudsPair(
  data: PlaceData,
  frame: number,
  item: StoryItem | null,
  aspect: number,
): CloudsPair | null {
  return (item === null ? null : aroundChange(data, item, aspect)) ?? wholeView(data, frame, aspect)
}
