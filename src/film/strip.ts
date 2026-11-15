import type { Strip } from '#web/film/assets.ts'
import {
  EARTH_RADIUS_KM,
  cross,
  dot,
  fromLonLat,
  normalize,
  slerp,
  toLonLat,
  type LonLat,
  type Vec3,
} from '#web/film/geo.ts'

export interface StripAxis {
  readonly start: Vec3
  readonly pole: Vec3
}

export function stripAxis(strip: Strip): StripAxis {
  const start = fromLonLat(strip.centreline[0])
  return { start, pole: normalize(cross(start, fromLonLat(strip.centreline[1]))) }
}

export function alongKm(axis: StripAxis, point: LonLat): number {
  const p = fromLonLat(point)
  return Math.atan2(dot(p, cross(axis.pole, axis.start)), dot(p, axis.start)) * EARTH_RADIUS_KM
}

export function edgeUpTo(axis: StripAxis, edge: readonly LonLat[], limitKm: number): LonLat[] {
  const out: LonLat[] = []
  for (let i = 0; i < edge.length; i++) {
    const p = edge[i]
    if (p === undefined) continue
    const d = alongKm(axis, p)
    if (d <= limitKm) {
      out.push(p)
      continue
    }
    const prev = edge[i - 1]
    if (prev !== undefined && out.length > 0) {
      const d0 = alongKm(axis, prev)
      const t = (limitKm - d0) / (d - d0)
      out.push(toLonLat(slerp(fromLonLat(prev), fromLonLat(p), t)))
    }
    break
  }
  return out
}
