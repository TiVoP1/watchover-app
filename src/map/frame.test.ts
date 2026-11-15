import { describe, expect, it } from 'vitest'
import type { Corners } from '#web/data/types.ts'
import { distanceKm } from '#web/film/geo.ts'
import {
  FOG_OPACITY,
  fogRings,
  frameOutline,
  gridPoint,
  insideWatched,
  MIN_VIEW_SHARE,
  neighbourSquares,
  centreBounds,
  clampToBounds,
  frameLabelSpot,
  placeMinZoom,
  windowCentre,
  windowSquare,
} from '#web/map/frame.ts'
import { groundSizeM } from '#web/story/crop.ts'

const corners: Corners = [
  [21.84056, 50.716533],
  [22.265422, 50.712696],
  [22.258215, 50.442967],
  [21.835771, 50.446768],
]

const near = (a: readonly number[] | undefined, b: readonly number[]) => {
  expect(a?.[0]).toBeCloseTo(b[0] ?? Number.NaN, 9)
  expect(a?.[1]).toBeCloseTo(b[1] ?? Number.NaN, 9)
}

describe('gridPoint', () => {
  it('returns the corners of the window at its own unit square', () => {
    near(gridPoint(corners, 0, 0), corners[0])
    near(gridPoint(corners, 1, 0), corners[1])
    near(gridPoint(corners, 1, 1), corners[2])
    near(gridPoint(corners, 0, 1), corners[3])
  })

  it('steps one window east and north outside the unit square', () => {
    const { widthM, heightM } = groundSizeM(corners)
    expect(distanceKm(gridPoint(corners, 1, 0), gridPoint(corners, 2, 0)) * 1000).toBeCloseTo(
      widthM,
      -2,
    )
    expect(distanceKm(gridPoint(corners, 0, 0), gridPoint(corners, 0, -1)) * 1000).toBeCloseTo(
      heightM,
      -2,
    )
  })
})

describe('frameOutline', () => {
  it('closes the line around the four corners', () => {
    const line = frameOutline(corners).geometry.coordinates
    expect(line).toHaveLength(5)
    near(line[0], corners[0])
    near(line[4], corners[0])
  })
})

describe('neighbourSquares', () => {
  const squares = neighbourSquares(corners).features

  it('draws the eight windows around the watched one', () => {
    expect(squares).toHaveLength(8)
    expect(squares.some((f) => f.properties.east === 0 && f.properties.north === 0)).toBe(false)
  })

  it('shares the edge with the watched window, so the dashes meet the frame', () => {
    const east = squares.find((f) => f.properties.east === 1 && f.properties.north === 0)
    const ring = east?.geometry.coordinates[0] ?? []
    near(ring[0], corners[1])
    near(ring[1], corners[2])
  })
})

describe('fogRings', () => {
  const rings = fogRings(corners).features

  it('thickens the fog outwards in three steps', () => {
    expect(rings.map((f) => f.properties.opacity)).toEqual([...FOG_OPACITY])
    expect(rings.map((f) => f.properties.ring)).toEqual([1, 2, 3])
  })

  it('leaves the watched window clear: the first ring has it as its hole', () => {
    const hole = rings[0]?.geometry.coordinates[1] ?? []
    expect(hole).toHaveLength(5)
    for (const corner of corners) {
      expect(hole.some(([lon = 0, lat = 0]) => distanceKm([lon, lat], corner) < 1e-6)).toBe(true)
    }
  })

  it('reaches the whole world with the last ring', () => {
    const outer = rings[2]?.geometry.coordinates[0] ?? []
    expect(Math.min(...outer.map(([lon = 0]) => lon))).toBe(-180)
    expect(Math.max(...outer.map(([lon = 0]) => lon))).toBe(180)
  })
})

describe('centreBounds', () => {
  it('lets the view centre go half a window past each edge, so part of the window stays in view', () => {
    const [[west, south], [east, north]] = centreBounds(corners)
    const { widthM } = groundSizeM(corners)
    const spanKm = distanceKm([west, (south + north) / 2], [east, (south + north) / 2])
    expect(spanKm * 1000).toBeGreaterThan(1.95 * widthM)
    expect(spanKm * 1000).toBeLessThan(2.1 * widthM)
    expect(insideWatched(corners, [west, south])).toBe(false)
  })
})

describe('clampToBounds', () => {
  const bounds = centreBounds(corners)

  it('pulls a centre far out in the fog back to the edge of the allowed box', () => {
    const [[west, south], [east, north]] = bounds
    expect(clampToBounds(bounds, [west - 1, north + 1])).toEqual([west, north])
    expect(clampToBounds(bounds, [east + 1, south - 1])).toEqual([east, south])
  })

  it('leaves a centre inside the box alone', () => {
    const centre = windowCentre(corners)
    expect(clampToBounds(bounds, centre)).toEqual(centre)
  })
})

describe('placeMinZoom', () => {
  it('keeps the window at least a third of the view in the tighter direction', () => {
    const view = { width: 1552, height: 868 }
    const zoom = placeMinZoom(corners, view)
    const [, lat] = windowCentre(corners)
    const metresPerPx = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom)
    const { widthM, heightM } = groundSizeM(corners)
    expect(widthM / metresPerPx).toBeCloseTo(view.width * MIN_VIEW_SHARE, 6)
    expect(heightM / metresPerPx).toBeGreaterThan(view.height * MIN_VIEW_SHARE)
  })
})

describe('insideWatched', () => {
  it('tells the watched window from the fog around it', () => {
    expect(insideWatched(corners, windowCentre(corners))).toBe(true)
    expect(insideWatched(corners, gridPoint(corners, 1.2, 0.5))).toBe(false)
  })
})

describe('windowSquare', () => {
  it('fills the window with one closed ring', () => {
    const [ring] = windowSquare(corners).geometry.coordinates
    expect(ring).toHaveLength(5)
    near(ring?.[0], corners[0])
    near(ring?.[2], corners[2])
  })
})

describe('frameLabelSpot', () => {
  const view = { width: 900, height: 600 }
  const label = { width: 330, height: 20 }
  const screen = (offsetX: number) => (lonLat: readonly [number, number]) => ({
    x: (lonLat[0] - 21.8) * 1500 + offsetX,
    y: (50.75 - lonLat[1]) * 1500,
  })

  it('stands on the north-west corner while it is in view', () => {
    expect(frameLabelSpot(corners, screen(100), view, label, 8)?.anchor).toBe('bottom-left')
  })

  it('moves to a corner still in view when the west edge leaves it', () => {
    const spot = frameLabelSpot(corners, screen(-200), view, label, 8)
    expect(spot?.anchor).toBe('bottom-right')
    expect(spot?.lonLat).toBe(corners[1])
  })

  it('hides when no corner leaves room for the label', () => {
    expect(frameLabelSpot(corners, screen(-5000), view, label, 8)).toBeNull()
  })
})
