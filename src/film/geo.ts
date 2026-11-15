export type Vec3 = readonly [number, number, number]
export type LonLat = readonly [number, number]
export type Affine = readonly [
  uLon: number,
  uLat: number,
  u0: number,
  vLon: number,
  vLat: number,
  v0: number,
]
export type BBox = readonly [west: number, south: number, east: number, north: number]

export const EARTH_RADIUS_KM = 6371
const RAD = Math.PI / 180

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / length(a))
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))

/** Unit sphere with x towards lon 0, z towards the north pole; radius in Earth radii. */
export function fromLonLat([lon, lat]: LonLat, radius = 1): Vec3 {
  const cl = Math.cos(lat * RAD)
  return [
    radius * cl * Math.cos(lon * RAD),
    radius * cl * Math.sin(lon * RAD),
    radius * Math.sin(lat * RAD),
  ]
}

export function toLonLat(v: Vec3): LonLat {
  return [
    Math.atan2(v[1], v[0]) / RAD,
    Math.asin(Math.max(-1, Math.min(1, v[2] / length(v)))) / RAD,
  ]
}

export function angle(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b))
}

export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const omega = angle(a, b)
  if (omega < 1e-9) return mix(a, b, t)
  const s = Math.sin(omega)
  return add(scale(a, Math.sin((1 - t) * omega) / s), scale(b, Math.sin(t * omega) / s))
}

export function eastNorthUp([lon, lat]: LonLat): { east: Vec3; north: Vec3; up: Vec3 } {
  const lo = lon * RAD
  const la = lat * RAD
  return {
    east: [-Math.sin(lo), Math.cos(lo), 0],
    north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    up: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
  }
}

export function destination(from: LonLat, bearingDeg: number, distanceKm: number): LonLat {
  const { east, north, up } = eastNorthUp(from)
  const heading = add(
    scale(north, Math.cos(bearingDeg * RAD)),
    scale(east, Math.sin(bearingDeg * RAD)),
  )
  const delta = distanceKm / EARTH_RADIUS_KM
  return toLonLat(add(scale(up, Math.cos(delta)), scale(heading, Math.sin(delta))))
}

export function bearingDeg(from: LonLat, to: LonLat): number {
  const { east, north } = eastNorthUp(from)
  const d = sub(fromLonLat(to), fromLonLat(from))
  return Math.atan2(dot(d, east), dot(d, north)) / RAD
}

export function distanceKm(a: LonLat, b: LonLat): number {
  return angle(fromLonLat(a), fromLonLat(b)) * EARTH_RADIUS_KM
}

export function bboxAffine([west, south, east, north]: BBox): Affine {
  return [
    1 / (east - west),
    0,
    -west / (east - west),
    0,
    -1 / (north - south),
    north / (north - south),
  ]
}

export function applyAffine(m: Affine, [lon, lat]: LonLat): readonly [number, number] {
  return [m[0] * lon + m[1] * lat + m[2], m[3] * lon + m[4] * lat + m[5]]
}

export function fitAffine(
  from: readonly LonLat[],
  to: readonly (readonly [number, number])[],
): Affine {
  const n = Math.min(from.length, to.length)
  const ata = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const atu = [0, 0, 0]
  const atv = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const p = from[i]
    const q = to[i]
    if (p === undefined || q === undefined) continue
    const row = [p[0], p[1], 1]
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++)
        ata[r * 3 + c] = (ata[r * 3 + c] ?? 0) + (row[r] ?? 0) * (row[c] ?? 0)
      atu[r] = (atu[r] ?? 0) + (row[r] ?? 0) * q[0]
      atv[r] = (atv[r] ?? 0) + (row[r] ?? 0) * q[1]
    }
  }
  const [a, b, c] = solve3(ata, atu)
  const [d, e, f] = solve3(ata, atv)
  return [a, b, c, d, e, f]
}

function solve3(m: readonly number[], v: readonly number[]): readonly [number, number, number] {
  const at = (i: number) => m[i] ?? 0
  const det3 = (c0: readonly number[], c1: readonly number[], c2: readonly number[]) =>
    (c0[0] ?? 0) * ((c1[1] ?? 0) * (c2[2] ?? 0) - (c2[1] ?? 0) * (c1[2] ?? 0)) -
    (c1[0] ?? 0) * ((c0[1] ?? 0) * (c2[2] ?? 0) - (c2[1] ?? 0) * (c0[2] ?? 0)) +
    (c2[0] ?? 0) * ((c0[1] ?? 0) * (c1[2] ?? 0) - (c1[1] ?? 0) * (c0[2] ?? 0))
  const col0 = [at(0), at(3), at(6)]
  const col1 = [at(1), at(4), at(7)]
  const col2 = [at(2), at(5), at(8)]
  const det = det3(col0, col1, col2)
  return [det3(v, col1, col2) / det, det3(col0, v, col2) / det, det3(col0, col1, v) / det]
}

export function insideRing(point: LonLat, ring: readonly LonLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a === undefined || b === undefined) continue
    if (a[1] > point[1] !== b[1] > point[1]) {
      const x = a[0] + ((point[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
      if (point[0] < x) inside = !inside
    }
  }
  return inside
}
