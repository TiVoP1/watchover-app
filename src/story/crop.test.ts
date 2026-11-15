import { describe, expect, it } from 'vitest'
import type { BBox, Corners } from '#web/data/types.ts'
import { applyAffine, distanceKm } from '#web/film/geo.ts'
import {
  bboxRect,
  cropAround,
  groundSizeM,
  imageAffine,
  paddedBBox,
  squareBBox,
} from '#web/story/crop.ts'

const CORNERS: Corners = [
  [21.84056, 50.716533],
  [22.265422, 50.712696],
  [22.258215, 50.442967],
  [21.835771, 50.446768],
]

const FOREST: BBox = [21.97499, 50.60032, 21.98123, 50.60163]
const WHOLE_VIEW: BBox = [21.83577, 50.44297, 22.26542, 50.71653]

describe('imageAffine', () => {
  it('sends the corners to the corners of the unit square within a few pixels of 1500', () => {
    const affine = imageAffine(CORNERS)
    const [tl, tr, br, bl] = CORNERS.map((c) => applyAffine(affine, c))
    expect(tl?.[0]).toBeCloseTo(0, 2)
    expect(tl?.[1]).toBeCloseTo(0, 2)
    expect(tr?.[0]).toBeCloseTo(1, 2)
    expect(br?.[1]).toBeCloseTo(1, 2)
    expect(bl?.[0]).toBeCloseTo(0, 2)
  })
})

describe('groundSizeM', () => {
  it('measures the 30 km window', () => {
    const { widthM, heightM } = groundSizeM(CORNERS)
    expect(widthM).toBeGreaterThan(29_800)
    expect(widthM).toBeLessThan(30_100)
    expect(heightM).toBeGreaterThan(29_800)
    expect(heightM).toBeLessThan(30_100)
  })
})

describe('cropAround', () => {
  it('opens a square of at least 1.5 km around a small patch and keeps the patch inside', () => {
    const { crop, outline } = cropAround(CORNERS, FOREST)
    const { widthM, heightM } = groundSizeM(CORNERS)
    expect(crop.w * widthM).toBeCloseTo(1500, 0)
    expect(crop.h * heightM).toBeCloseTo(1500, 0)
    expect(outline.x).toBeGreaterThan(0)
    expect(outline.y).toBeGreaterThan(0)
    expect(outline.x + outline.w).toBeLessThan(1)
    expect(outline.y + outline.h).toBeLessThan(1)
    const box = bboxRect(CORNERS, FOREST)
    expect(crop.x + outline.x * crop.w).toBeCloseTo(box.x, 9)
  })

  it('keeps the requested ground aspect', () => {
    const { crop } = cropAround(CORNERS, FOREST, {
      minSpanM: 1500,
      marginShare: 0.5,
      aspect: 4 / 3,
    })
    const { widthM, heightM } = groundSizeM(CORNERS)
    expect((crop.w * widthM) / (crop.h * heightM)).toBeCloseTo(4 / 3, 6)
    expect(crop.h * heightM).toBeCloseTo(1500, 0)
  })

  it('shrinks to the whole image for a scene-wide event', () => {
    const { crop } = cropAround(CORNERS, WHOLE_VIEW)
    expect(crop.x).toBeCloseTo(0, 6)
    expect(crop.w).toBeCloseTo(1, 6)
    expect(crop.h).toBeGreaterThan(0.99)
  })

  it('slides inside the image near an edge', () => {
    const corner: BBox = [21.8365, 50.714, 21.8375, 50.715]
    const { crop } = cropAround(CORNERS, corner)
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(0)
  })

  it('opens the shortest side for a point', () => {
    const { crop } = cropAround(CORNERS, [22.05, 50.58, 22.05, 50.58])
    expect(crop.w * groundSizeM(CORNERS).widthM).toBeCloseTo(1500, 0)
  })
})

describe('squareBBox', () => {
  it('draws a square of the same area around a point', () => {
    const [west, south, east, north] = squareBBox([22.045855, 50.579439], 22_400)
    const side = Math.sqrt(22_400)
    expect(distanceKm([west, 50.579439], [east, 50.579439]) * 1000).toBeCloseTo(side, 0)
    expect(distanceKm([22.045855, south], [22.045855, north]) * 1000).toBeCloseTo(side, 0)
  })
})

describe('paddedBBox', () => {
  it('gives the camera at least 1.5 km around a small patch', () => {
    const [west, south, east, north] = paddedBBox(FOREST)
    const lat = (south + north) / 2
    expect(distanceKm([west, lat], [east, lat]) * 1000).toBeCloseTo(1500, 0)
    expect(west).toBeLessThan(FOREST[0])
    expect(north).toBeGreaterThan(FOREST[3])
  })
})
