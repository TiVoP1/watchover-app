import { describe, expect, it } from 'vitest'
import { losColour, mixColour } from '#web/business/tint.ts'
import { LOS_RAMP } from '#web/tokens.ts'

describe('mixColour', () => {
  it('blends two colours channel by channel', () => {
    expect(mixColour('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixColour('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixColour('#000000', '#ff8040', 0.5)).toBe('#804020')
  })
})

describe('losColour', () => {
  it('runs the berlin map from away (red) through dark to towards (blue)', () => {
    expect(losColour(-1)).toBe(LOS_RAMP[0])
    expect(losColour(0)).toBe(LOS_RAMP[4])
    expect(losColour(1)).toBe(LOS_RAMP[8])
    expect(losColour(0.25)).toBe(LOS_RAMP[5])
  })

  it('interpolates between stops and clamps beyond the ends', () => {
    expect(losColour(0.125)).toBe(mixColour(LOS_RAMP[4], LOS_RAMP[5], 0.5))
    expect(losColour(3)).toBe(LOS_RAMP[8])
    expect(losColour(-3)).toBe(LOS_RAMP[0])
  })
})
