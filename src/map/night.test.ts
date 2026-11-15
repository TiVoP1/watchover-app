import { describe, expect, it } from 'vitest'
import { equirectBands, mercatorEdgeLatDeg, NIGHT_CORNERS } from '#web/map/night.ts'

describe('mercatorEdgeLatDeg', () => {
  it('puts the Web Mercator limit on the outer edges and the equator in the middle', () => {
    expect(mercatorEdgeLatDeg(0, 8)).toBeCloseTo(85.051129, 5)
    expect(mercatorEdgeLatDeg(4, 8)).toBeCloseTo(0, 9)
    expect(mercatorEdgeLatDeg(8, 8)).toBeCloseTo(-85.051129, 5)
  })
})

describe('equirectBands', () => {
  const bands = equirectBands(8, 180)

  it('starts at the Mercator limit on a 1 px per degree source and ends at its mirror', () => {
    expect(bands[0]?.top).toBeCloseTo(90 - 85.051129, 5)
    const last = bands.at(-1)
    expect((last?.top ?? 0) + (last?.height ?? 0)).toBeCloseTo(90 + 85.051129, 5)
  })

  it('leaves no gap between rows', () => {
    for (const [row, band] of bands.slice(1).entries()) {
      const previous = bands[row]
      expect(band.top).toBeCloseTo((previous?.top ?? 0) + (previous?.height ?? 0), 9)
    }
  })

  it('gives rows near the equator more source pixels than rows near the poles', () => {
    expect(bands[4]?.height ?? 0).toBeGreaterThan(bands[0]?.height ?? 0)
  })
})

describe('NIGHT_CORNERS', () => {
  it('covers the whole Web Mercator square from the north-west corner clockwise', () => {
    expect(NIGHT_CORNERS[0]).toEqual([-180, 85.051129])
    expect(NIGHT_CORNERS[2]).toEqual([180, -85.051129])
  })
})
