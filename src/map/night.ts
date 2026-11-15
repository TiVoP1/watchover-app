import type { Corners } from '#web/data/types.ts'

const MERCATOR_LIMIT_DEG = 85.051129

export const NIGHT_EQUIRECT_URL = '/data/world/night-world.webp'
export const NIGHT_SIZE_PX = 2048
export const NIGHT_FLOOR = 0.02
export const NIGHT_CEILING = 0.94

export const NIGHT_CORNERS: Corners = [
  [-180, MERCATOR_LIMIT_DEG],
  [180, MERCATOR_LIMIT_DEG],
  [180, -MERCATOR_LIMIT_DEG],
  [-180, -MERCATOR_LIMIT_DEG],
]

export interface SourceBand {
  readonly top: number
  readonly height: number
}

export const mercatorEdgeLatDeg = (row: number, rows: number): number =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / rows))) * 180) / Math.PI

export function equirectBands(rows: number, sourceHeightPx: number): readonly SourceBand[] {
  const sourceRow = (latDeg: number) => ((90 - latDeg) / 180) * sourceHeightPx
  return Array.from({ length: rows }, (_, row) => {
    const top = sourceRow(mercatorEdgeLatDeg(row, rows))
    return { top, height: sourceRow(mercatorEdgeLatDeg(row + 1, rows)) - top }
  })
}

export async function loadNightMercator(url: string, sizePx: number): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = sizePx
  canvas.height = sizePx
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Canvas 2D context unavailable')
  for (const [row, band] of equirectBands(sizePx, image.naturalHeight).entries()) {
    const height = Math.max(band.height, 1)
    context.drawImage(image, 0, band.top, image.naturalWidth, height, 0, row, sizePx, 1)
  }
  return canvas
}
