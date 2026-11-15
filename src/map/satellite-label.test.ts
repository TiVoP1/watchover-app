import { describe, expect, it } from 'vitest'
import { type Box, labelBox, labelSide } from '#web/map/satellite-label.ts'

const size = { reachPx: 374, heightPx: 40 }
const view: Box = { left: 0, top: 0, right: 912, bottom: 508 }

describe('satellite label', () => {
  it('reaches from the satellite centre to the far edge on its side', () => {
    expect(labelBox('left', { x: 400, y: 100 }, size)).toEqual({
      left: 26,
      top: 80,
      right: 400,
      bottom: 120,
    })
    expect(labelBox('right', { x: 400, y: 100 }, size).right).toBe(774)
  })

  it('keeps the preferred side while it stays in view and clear of other labels', () => {
    expect(labelSide('left', { x: 400, y: 100 }, size, view, [])).toBe('left')
  })

  it('switches sides at the edge of the view', () => {
    expect(labelSide('left', { x: 340, y: 100 }, size, view, [])).toBe('right')
    expect(labelSide('right', { x: 700, y: 100 }, size, view, [])).toBe('left')
    expect(labelSide('right', { x: 400, y: 10 }, size, view, [])).toBeNull()
  })

  it('hides rather than cover a place label on either side', () => {
    const place: Box = { left: 450, top: 240, right: 700, bottom: 270 }
    const ring: Box = { left: 200, top: 245, right: 220, bottom: 265 }
    expect(labelSide('right', { x: 420, y: 250 }, size, view, [place])).toBe('left')
    expect(labelSide('right', { x: 420, y: 250 }, size, view, [place, ring])).toBeNull()
    expect(labelSide('right', { x: 420, y: 320 }, size, view, [place, ring])).toBe('right')
  })
})
