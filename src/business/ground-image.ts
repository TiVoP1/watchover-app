import { cropCorners, type GroundOverlay } from '#web/business/ground.ts'
import type { Corners } from '#web/data/types.ts'
import { loadImage } from '#web/story/images.ts'

export interface DrawnOverlay {
  readonly url: string
  readonly corners: Corners
}

export async function drawnOverlay({ url, image, crop }: GroundOverlay): Promise<DrawnOverlay> {
  if (crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1) return { url, corners: image }
  const picture = await loadImage(url)
  const width = picture.naturalWidth
  const height = picture.naturalHeight
  const x = Math.round(crop.x * width)
  const y = Math.round(crop.y * height)
  const w = Math.max(1, Math.round((crop.x + crop.w) * width) - x)
  const h = Math.max(1, Math.round((crop.y + crop.h) * height) - y)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d')
  if (context === null) throw new Error(`${url}: no 2d canvas to crop the overlay`)
  context.drawImage(picture, x, y, w, h, 0, 0, w, h)
  const snapped = { x: x / width, y: y / height, w: w / width, h: h / height }
  return { url: canvas.toDataURL(), corners: cropCorners(image, snapped) }
}
