import { describe, expect, it } from 'vitest'
import {
  COVERAGE_KEY,
  covers,
  parseCoverage,
  shownLayer,
  tileRange,
  tileX,
  tileY,
} from '#web/map/basemap-extract.ts'

describe('tile math', () => {
  it('finds the slippy map tile of Stalowa Wola', () => {
    expect([tileX(22.05, 10), tileY(50.58, 10)]).toEqual([574, 344])
  })

  it('clamps a box past the poles and the antimeridian to the grid', () => {
    expect(tileRange(2, [-180, -90, 180, 90])).toEqual([2, 0, 0, 3, 3])
  })

  it('orders rows from north to south', () => {
    expect(tileRange(10, [21.8, 50.4, 22.3, 50.8])).toEqual([10, 574, 343, 575, 345])
  })
})

describe('covers', () => {
  const ranges = [[10, 570, 340, 579, 349]] as const

  it('accepts a tile inside a range of its zoom', () => {
    expect(covers(ranges, '10/574/344')).toBe(true)
  })

  it('rejects a tile outside the range or at another zoom', () => {
    expect(covers(ranges, '10/580/344')).toBe(false)
    expect(covers(ranges, '11/574/344')).toBe(false)
  })

  it('rejects a malformed tile path', () => {
    expect(covers(ranges, 'fonts/0-255')).toBe(false)
  })
})

describe('parseCoverage', () => {
  it('reads the ranges written by the fetch script', () => {
    expect(parseCoverage({ [COVERAGE_KEY]: [[0, 0, 0, 0, 0]] })).toEqual([[0, 0, 0, 0, 0]])
  })

  it('refuses a style without valid ranges', () => {
    expect(parseCoverage(undefined)).toBeNull()
    expect(parseCoverage({})).toBeNull()
    expect(parseCoverage({ [COVERAGE_KEY]: [[0, 0, 0, 0]] })).toBeNull()
    expect(parseCoverage({ [COVERAGE_KEY]: [[0, 0.5, 0, 0, 0]] })).toBeNull()
  })
})

describe('shownLayer', () => {
  it('keeps water, roads and place labels', () => {
    expect(shownLayer({ id: 'water', type: 'fill' })).toBe(true)
    expect(shownLayer({ id: 'highway_motorway_inner', type: 'line' })).toBe(true)
    expect(shownLayer({ id: 'place_city', type: 'symbol' })).toBe(true)
  })

  it('drops buildings, piers, small places and labels other than towns', () => {
    expect(shownLayer({ id: 'building', type: 'fill' })).toBe(false)
    expect(shownLayer({ id: 'road_area_pier', type: 'fill' })).toBe(false)
    expect(shownLayer({ id: 'place_village', type: 'symbol' })).toBe(false)
    expect(shownLayer({ id: 'place_state', type: 'symbol' })).toBe(false)
    expect(shownLayer({ id: 'place_country_major', type: 'symbol' })).toBe(false)
    expect(shownLayer({ id: 'highway_name_other', type: 'symbol' })).toBe(false)
  })
})
