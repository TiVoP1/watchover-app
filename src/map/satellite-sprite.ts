import { lookAt } from '#web/film/camera.ts'
import { normalize, type Vec3 } from '#web/film/geo.ts'
import { drawSatellite, type SatellitePose } from '#web/film/satellite.ts'

const CANVAS_PX = 272
const LENS_FOV_DEG = 34
const RANGE_M = 60
const M_PER_EARTH_RADIUS = 6_371_000
const SUN: Vec3 = normalize([-0.5, 0.4, 0.75])
const POSE: SatellitePose = { position: [RANGE_M, 0, 0], forward: [0, 1, 0], up: [0, 0, 1] }
const OPAQUE_ALPHA = 8

interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

function opaqueBox(pixels: Uint8ClampedArray, size: number): Box | null {
  let [x0, y0, x1, y1] = [size, size, -1, -1]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((pixels[(y * size + x) * 4 + 3] ?? 0) <= OPAQUE_ALPHA) continue
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

let drawn: string | null = null

export function satelliteSprite(): string | null {
  if (drawn !== null) return drawn
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_PX
  canvas.height = CANVAS_PX
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) return null
  const lens = lookAt([0, 0, 0], [1, 0, 0], [0, 0, 1], LENS_FOV_DEG, CANVAS_PX, CANVAS_PX)
  drawSatellite(context, lens, POSE, SUN, M_PER_EARTH_RADIUS)
  const box = opaqueBox(context.getImageData(0, 0, CANVAS_PX, CANVAS_PX).data, CANVAS_PX)
  if (box === null) return null
  const sprite = document.createElement('canvas')
  sprite.width = box.w
  sprite.height = box.h
  sprite.getContext('2d')?.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
  drawn = sprite.toDataURL('image/png')
  return drawn
}
