import { describe, expect, it } from 'vitest'
import { largestValidRect } from '#web/film/crop.ts'

describe('crop', () => {
  it('takes the whole frame when every pixel holds data', () => {
    const mask = new Uint8Array(32 * 18).fill(1)
    expect(largestValidRect(mask, 32, 18, 16 / 9)).toEqual({ x: 0, y: 0, w: 32, h: 18 })
  })

  it('stays clear of a no-data wedge', () => {
    const width = 40
    const height = 40
    const mask = new Uint8Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) mask[y * width + x] = x < width - y / 2 ? 1 : 0
    }
    const rect = largestValidRect(mask, width, height, 16 / 9)
    expect(rect).not.toBeNull()
    if (rect === null) return
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) expect(mask[y * width + x]).toBe(1)
    }
  })

  it('gives up on an empty mask', () => {
    expect(largestValidRect(new Uint8Array(16 * 9), 16, 9, 16 / 9)).toBeNull()
  })
})
