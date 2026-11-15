import {
  EARTH_RADIUS_KM,
  add,
  cross,
  dot,
  eastNorthUp,
  fromLonLat,
  length,
  normalize,
  scale,
  sub,
  type LonLat,
  type Vec3,
} from '#web/film/geo.ts'

export interface Camera {
  readonly eye: Vec3
  readonly right: Vec3
  readonly up: Vec3
  readonly forward: Vec3
  readonly focalPx: number
  readonly width: number
  readonly height: number
}

export interface ScreenPoint {
  readonly x: number
  readonly y: number
  readonly depth: number
}

export interface GroundView {
  readonly target: LonLat
  readonly rangeKm: number
  readonly offNadirDeg: number
  readonly headingDeg: number
  readonly fovYDeg: number
}

const RAD = Math.PI / 180

export function lookAt(
  eye: Vec3,
  target: Vec3,
  upHint: Vec3,
  fovYDeg: number,
  width: number,
  height: number,
): Camera {
  const forward = normalize(sub(target, eye))
  const right = normalize(cross(forward, upHint))
  const up = cross(right, forward)
  return {
    eye,
    right,
    up,
    forward,
    focalPx: height / 2 / Math.tan((fovYDeg * RAD) / 2),
    width,
    height,
  }
}

export function groundCamera(view: GroundView, width: number, height: number): Camera {
  const { east, north, up } = eastNorthUp(view.target)
  const heading = add(
    scale(north, Math.cos(view.headingDeg * RAD)),
    scale(east, Math.sin(view.headingDeg * RAD)),
  )
  const tilt = view.offNadirDeg * RAD
  const direction = add(scale(heading, Math.sin(tilt)), scale(up, -Math.cos(tilt)))
  const target = fromLonLat(view.target)
  const eye = sub(target, scale(direction, view.rangeKm / EARTH_RADIUS_KM))
  const upHint = add(scale(heading, Math.cos(tilt)), scale(up, Math.sin(tilt)))
  return lookAt(eye, target, upHint, view.fovYDeg, width, height)
}

export function project(cam: Camera, p: Vec3): ScreenPoint | null {
  const d = sub(p, cam.eye)
  const depth = dot(d, cam.forward)
  if (depth <= 1e-12) return null
  return {
    x: cam.width / 2 + (dot(d, cam.right) / depth) * cam.focalPx,
    y: cam.height / 2 - (dot(d, cam.up) / depth) * cam.focalPx,
    depth,
  }
}

export function hiddenBySphere(cam: Camera, p: Vec3): boolean {
  const toPoint = sub(p, cam.eye)
  const distance = length(toPoint)
  const dir = scale(toPoint, 1 / distance)
  const b = dot(cam.eye, dir)
  const c = dot(cam.eye, cam.eye) - 1
  const disc = b * b - c
  if (disc <= 0) return false
  const hit = -b - Math.sqrt(disc)
  return hit > 0 && hit < distance - 1e-7
}

export function altitudeKm(cam: Camera): number {
  return (length(cam.eye) - 1) * EARTH_RADIUS_KM
}

export function rayThrough(cam: Camera, x: number, y: number): Vec3 {
  const dx = (x - cam.width / 2) / cam.focalPx
  const dy = (cam.height / 2 - y) / cam.focalPx
  return normalize(add(cam.forward, add(scale(cam.right, dx), scale(cam.up, dy))))
}

export function groundAt(cam: Camera, x: number, y: number): Vec3 | null {
  const dir = rayThrough(cam, x, y)
  const b = dot(cam.eye, dir)
  const disc = b * b - (dot(cam.eye, cam.eye) - 1)
  if (disc < 0 || b >= 0) return null
  return add(cam.eye, scale(dir, -b - Math.sqrt(disc)))
}
