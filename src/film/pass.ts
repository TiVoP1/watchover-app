import type { Pass } from '#web/film/assets.ts'
import { bearingDeg, fitAffine, type Affine, type LonLat } from '#web/film/geo.ts'

export interface PassCorners {
  readonly startWest: LonLat
  readonly startEast: LonLat
  readonly endEast: LonLat
  readonly endWest: LonLat
}

export function passCorners(pass: Pass): PassCorners {
  const bySouth = [...pass.footprint].sort((a, b) => a[1] - b[1])
  const [s0, s1, n0, n1] = bySouth
  if (s0 === undefined || s1 === undefined || n0 === undefined || n1 === undefined) {
    throw new Error(`${pass.scene}: footprint needs four corners`)
  }
  const [southWest, southEast] = s0[0] < s1[0] ? [s0, s1] : [s1, s0]
  const [northWest, northEast] = n0[0] < n1[0] ? [n0, n1] : [n1, n0]
  return pass.direction === 'ASCENDING'
    ? { startWest: southWest, startEast: southEast, endEast: northEast, endWest: northWest }
    : { startWest: northWest, startEast: northEast, endEast: southEast, endWest: southWest }
}

export function passAffine(pass: Pass): Affine {
  const c = passCorners(pass)
  return fitAffine(
    [c.startWest, c.startEast, c.endEast, c.endWest],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  )
}

export function passHeadingDeg(pass: Pass): number {
  const c = passCorners(pass)
  const start: LonLat = [
    (c.startWest[0] + c.startEast[0]) / 2,
    (c.startWest[1] + c.startEast[1]) / 2,
  ]
  const end: LonLat = [(c.endWest[0] + c.endEast[0]) / 2, (c.endWest[1] + c.endEast[1]) / 2]
  return bearingDeg(start, end)
}

export function alongRange(pass: Pass, corners: readonly LonLat[]): readonly [number, number] {
  const m = passAffine(pass)
  const along = corners.map((p) => m[3] * p[0] + m[4] * p[1] + m[5])
  return [Math.min(...along), Math.max(...along)]
}

export function passRing(pass: Pass): readonly LonLat[] {
  const c = passCorners(pass)
  return [c.startWest, c.startEast, c.endEast, c.endWest]
}
