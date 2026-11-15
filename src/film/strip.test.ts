import { describe, expect, it } from 'vitest'
import type { Strip } from '#web/film/assets.ts'
import { distanceKm } from '#web/film/geo.ts'
import { alongKm, edgeUpTo, stripAxis } from '#web/film/strip.ts'

const STRIP: Strip = {
  track: 28,
  day: '2026-10-26',
  frames: [21, 22, 23, 24, 25, 26, 27, 28],
  centreline: [
    [29.36237, 38.54566],
    [22.25352, 52.15378],
  ],
  leftEdge: [
    [27.9, 38.2],
    [21.0, 51.8],
  ],
  rightEdge: [
    [30.8, 38.9],
    [23.5, 52.5],
  ],
}

describe('strip', () => {
  it('measures along-track distance from the first frame centre', () => {
    const axis = stripAxis(STRIP)
    expect(alongKm(axis, STRIP.centreline[0])).toBeCloseTo(0, 6)
    expect(alongKm(axis, STRIP.centreline[1])).toBeCloseTo(
      distanceKm(STRIP.centreline[0], STRIP.centreline[1]),
      3,
    )
  })

  it('cuts an edge at the tear front', () => {
    const axis = stripAxis(STRIP)
    const total = alongKm(axis, STRIP.centreline[1])
    const half = edgeUpTo(axis, STRIP.leftEdge, total / 2)
    expect(half).toHaveLength(2)
    const end = half[1]
    expect(end).toBeDefined()
    if (end === undefined) return
    expect(alongKm(axis, end)).toBeCloseTo(total / 2, 0)
    expect(edgeUpTo(axis, STRIP.leftEdge, -10_000)).toHaveLength(0)
  })
})
