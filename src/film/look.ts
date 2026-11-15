import type { GlobeLook, Rgb } from '#web/film/globe.ts'
import { COLOR } from '#web/tokens.ts'

export function rgbBytes(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgb(hex: string): Rgb {
  const [r, g, b] = rgbBytes(hex)
  return [r / 255, g / 255, b / 255]
}

export const LOOK: GlobeLook = {
  bg: rgb(COLOR.bg),
  ocean: rgb(COLOR.mapWater),
  land: rgb(COLOR.mapLand),
  lightGain: 1,
  coverColor: rgb(COLOR.accent),
  limbColor: rgb(COLOR.line),
}
