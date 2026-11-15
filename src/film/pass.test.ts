import { describe, expect, it } from 'vitest'
import type { Pass } from '#web/film/assets.ts'
import { applyAffine } from '#web/film/geo.ts'
import { passAffine, passCorners, passHeadingDeg } from '#web/film/pass.ts'

const TRACK_28: Pass = {
  scene:
    'NISAR_L2_PR_GCOV_034_028_A_027_2005_DHDH_A_20261026T031336_20261026T031411_P05036_N_F_J_001',
  start: '2026-10-26T03:13:36Z',
  stop: '2026-10-26T03:14:11Z',
  direction: 'ASCENDING',
  footprint: [
    [25.75042, 49.69158],
    [24.54056, 51.7516],
    [21.13909, 50.87148],
    [22.47604, 48.84775],
  ],
}

describe('pass', () => {
  it('starts an ascending pass at its southern edge', () => {
    const c = passCorners(TRACK_28)
    expect(c.startWest).toEqual([22.47604, 48.84775])
    expect(c.endEast).toEqual([24.54056, 51.7516])
  })

  it('maps the footprint to across and along coordinates', () => {
    const m = passAffine(TRACK_28)
    const [across, along] = applyAffine(m, [23.48, 50.29])
    expect(across).toBeGreaterThan(0.4)
    expect(across).toBeLessThan(0.6)
    expect(along).toBeGreaterThan(0.4)
    expect(along).toBeLessThan(0.6)
  })

  it('flies north-north-west on an ascending pass over Poland', () => {
    const heading = passHeadingDeg(TRACK_28)
    expect(heading).toBeGreaterThan(-30)
    expect(heading).toBeLessThan(-15)
  })
})
