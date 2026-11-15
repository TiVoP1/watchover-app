import { describe, expect, it } from 'vitest'
import { compass, type LonLat, viewPart, whereFrom } from '#web/story/where.ts'

const CENTRE: LonLat = [22.05, 50.58]

describe('compass', () => {
  it('names eight sectors centred on the cardinal and diagonal bearings', () => {
    expect(compass(0)).toBe('north')
    expect(compass(22)).toBe('north')
    expect(compass(23)).toBe('north-east')
    expect(compass(180)).toBe('south')
    expect(compass(-65.5)).toBe('north-west')
    expect(compass(-67.6)).toBe('west')
    expect(compass(359)).toBe('north')
    expect(compass(720 + 90)).toBe('east')
  })
})

describe('whereFrom', () => {
  it('rounds the distance to whole kilometres and names the direction from the centre', () => {
    expect(whereFrom(CENTRE, [21.97805, 50.60094])).toEqual({
      kind: 'away',
      km: 6,
      toward: 'north-west',
    })
    expect(whereFrom(CENTRE, [22.06129, 50.4897])).toEqual({
      kind: 'away',
      km: 10,
      toward: 'south',
    })
    expect(whereFrom(CENTRE, [22.24098, 50.4963])).toEqual({
      kind: 'away',
      km: 16,
      toward: 'south-east',
    })
    expect(whereFrom(CENTRE, [22.050584, 50.554202])).toEqual({
      kind: 'away',
      km: 3,
      toward: 'south',
    })
  })

  it('calls anything within a kilometre the centre', () => {
    expect(whereFrom(CENTRE, [22.045855, 50.579439])).toEqual({ kind: 'centre' })
    expect(whereFrom(CENTRE, [22.042135, 50.578419])).toEqual({ kind: 'centre' })
  })
})

describe('viewPart', () => {
  it('names the share of the view in words', () => {
    expect(viewPart(0.53)).toBe('half')
    expect(viewPart(0.4)).toBe('half')
    expect(viewPart(0.75)).toBe('most')
    expect(viewPart(0.95)).toBe('all')
    expect(viewPart(0.2)).toBe('part')
  })
})
