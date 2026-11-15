import { describe, expect, it } from 'vitest'
import { findPass, parseHallMotion, parseStrip } from '#web/film/assets.ts'

const OSM = 'way/359317018'

const objects = (fit: Record<string, number>) => ({
  tracks: {
    '28A': { track: 28, passes: ['2026-06-28T03:13:39Z'], temperature_c: [23.8] },
    '123D': {
      track: 123,
      passes: ['2026-06-22T17:43:22Z', '2026-07-16T17:43:20Z', '2026-10-20T17:43:18Z'],
      temperature_c: [23.0, 26.9, 10.6],
    },
  },
  objects: [{ osm: OSM, tracks: { '28A': { mm_per_c: 0.172 }, '123D': fit } }],
})

describe('film assets', () => {
  it('reads the fitted motion of the hall and the temperature range of the chosen track', () => {
    const motion = parseHallMotion(objects({ mm_per_c: 0.302, mm_per_c_err: 0.058 }), OSM, 123)
    expect(motion.mmPerC).toBe(0.302)
    expect(motion.mmPerCErr).toBe(0.058)
    expect(motion.rangeC).toBeCloseTo(16.3, 9)
    expect(motion.rangeFrom).toBe('2026-07-16T17:43:20Z')
    expect(motion.rangeTo).toBe('2026-10-20T17:43:18Z')
  })

  it('names the file when a field is missing', () => {
    expect(() => parseHallMotion(objects({ mm_per_c: 0.302 }), OSM, 123)).toThrow(
      /objects\.json .*"mm_per_c_err"/,
    )
    expect(() => parseHallMotion(objects({}), OSM, 7)).toThrow(/objects\.json: no track 7/)
    expect(() => findPass({}, 'scene')).toThrow(/catalog\.json: missing "granules"/)
    expect(() => parseStrip({ strip: { frames: [] } })).toThrow(/manifest\.json strip/)
    expect(() => parseStrip({})).toThrow(/manifest\.json: missing "strip"/)
  })
})
