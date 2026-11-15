import { describe, expect, it } from 'vitest'
import {
  applyAffine,
  bboxAffine,
  bearingDeg,
  destination,
  distanceKm,
  fitAffine,
  fromLonLat,
  insideRing,
  toLonLat,
} from '#web/film/geo.ts'

describe('geo', () => {
  it('round-trips lon and lat through the unit sphere', () => {
    const [lon, lat] = toLonLat(fromLonLat([22.05, 50.58]))
    expect(lon).toBeCloseTo(22.05, 9)
    expect(lat).toBeCloseTo(50.58, 9)
  })

  it('walks a bearing and distance and measures them back', () => {
    const from = [22.05, 50.58] as const
    const to = destination(from, 68, 550)
    expect(distanceKm(from, to)).toBeCloseTo(550, 6)
    expect(bearingDeg(from, to)).toBeCloseTo(68, 6)
  })

  it('maps a bbox to unit texture coordinates with v growing south', () => {
    const m = bboxAffine([12, 44, 36, 58])
    const [u0, v0] = applyAffine(m, [12, 58])
    expect(u0).toBeCloseTo(0, 12)
    expect(v0).toBeCloseTo(0, 12)
    const [u, v] = applyAffine(m, [36, 44])
    expect(u).toBeCloseTo(1, 12)
    expect(v).toBeCloseTo(1, 12)
  })

  it('fits the affine through four corners', () => {
    const corners = [
      [21.84, 50.72],
      [22.27, 50.71],
      [22.26, 50.44],
      [21.84, 50.45],
    ] as const
    const uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const
    const m = fitAffine(corners, uv)
    const [u, v] = applyAffine(m, [22.05, 50.58])
    expect(u).toBeGreaterThan(0.4)
    expect(u).toBeLessThan(0.6)
    expect(v).toBeGreaterThan(0.4)
    expect(v).toBeLessThan(0.6)
  })

  it('tells inside from outside of a ring', () => {
    const ring = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ] as const
    expect(insideRing([1, 1], ring)).toBe(true)
    expect(insideRing([3, 1], ring)).toBe(false)
  })
})
