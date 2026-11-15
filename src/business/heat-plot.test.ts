import { describe, expect, it } from 'vitest'
import { heatPlot, LAYOUT, niceStep, ticksWithin } from '#web/business/heat-plot.ts'
import type { MotionObject } from '#web/data/types.ts'
import type { Heat, HeatOrbit } from '#web/story/chapters.ts'

const TIMES = [
  '2026-06-22T17:43:22Z',
  '2026-07-16T17:43:20Z',
  '2026-09-14T17:43:18Z',
  '2026-10-20T17:43:18Z',
]

const orbit = (overrides: Partial<HeatOrbit> = {}): HeatOrbit => ({
  key: '123D',
  track: 123,
  direction: 'DESCENDING',
  part: 'evening',
  passes: TIMES.map((time, i) => ({
    time,
    scene: `s${String(i)}`,
    tempC: [20, 27, 15, 11][i] ?? null,
    losMmFromColdest: [3, 5.4, 1, 0][i] ?? null,
  })),
  hot: 1,
  cold: 3,
  warmPasses: 1,
  hotColdMm: 5.4,
  hotColdErrMm: 1.2,
  mmPerC: 0.3,
  mmPerCErr: 0.06,
  ...overrides,
})

const OBJECT: MotionObject = {
  osm: 'way/1',
  kind: 'building',
  name: null,
  area_m2: 64_197,
  lon: 22.05,
  lat: 50.55,
  tracks: {},
  vertical_consistent: true,
  mm_per_c: 0.2,
  mm_per_c_err: 0.04,
}

const dawn = orbit({
  key: '28A',
  track: 28,
  direction: 'ASCENDING',
  part: 'dawn',
  passes: TIMES.map((time, i) => ({
    time,
    scene: `a${String(i)}`,
    tempC: 10,
    losMmFromColdest: i === 0 ? 3.6 : 0,
  })),
})

const heat: Heat = { object: OBJECT, evening: orbit(), dawn }

function plotOf(h: Heat, errorScale = 1.2, at?: string) {
  const plot = heatPlot(h, { width: 336, errorScale, at })
  if (plot === null) throw new Error('no plot')
  return plot
}

describe('heatPlot', () => {
  const plot = plotOf(heat)
  const mmAt = (index: number) => plot.mm.evening.find((p) => p.index === index)
  const cAt = (index: number) => plot.temperature.evening.find((p) => p.index === index)

  it('puts zero at the coldest pass, so a warm pass stands above it', () => {
    expect(mmAt(3)?.y).toBeCloseTo(plot.mm.zero, 6)
    expect(mmAt(1)?.y ?? Infinity).toBeLessThan(plot.mm.zero)
    expect(cAt(1)?.y ?? Infinity).toBeLessThan(cAt(3)?.y ?? -Infinity)
  })

  it('keeps the temperature strip above the millimetre strip on one date axis', () => {
    expect(plot.temperature.bottom).toBeLessThan(plot.mm.top)
    expect(cAt(1)?.x).toBeCloseTo(mmAt(1)?.x ?? NaN, 6)
    expect(plot.hot).toBe(1)
    expect(plot.cold).toBe(3)
  })

  it('draws error bars widened by the open-ground factor, none at the zero pass', () => {
    const hot = mmAt(1)
    const cold = mmAt(3)
    if (hot === undefined || cold === undefined) throw new Error('no points')
    const pxPerMm = (cold.y - hot.y) / 5.4
    expect(plot.mm.bars).toHaveLength(3)
    const bar = plot.mm.bars.find((b) => b.x === hot.x)
    expect((bar?.bottom ?? 0) - (bar?.top ?? 0)).toBeCloseTo(2 * 1.2 * 1.2 * pxPerMm, 6)
    expect(plot.mm.bars.some((b) => b.x === cold.x)).toBe(false)
  })

  it('draws the evening orbit only, whatever the dawn orbit holds', () => {
    expect(plot.mm.evening).toHaveLength(4)
    expect(plotOf({ ...heat, dawn: null })).toEqual(plot)
    expect(plot.height).toBe(LAYOUT.height)
  })

  it('labels the months between the first and last pass', () => {
    expect(plot.months.map((m) => m.time.slice(0, 7))).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('covers the plot with one hover column per evening pass', () => {
    expect(plot.columns.map((c) => c.index)).toEqual([0, 1, 2, 3])
    expect(plot.columns[0]?.from).toBe(plot.left)
    expect(plot.columns.at(-1)?.to).toBe(plot.width - plot.right)
    for (const [i, column] of plot.columns.entries()) {
      const next = plot.columns[i + 1]
      if (next !== undefined) expect(column.to).toBeCloseTo(next.from, 6)
    }
  })

  it('marks the evening pass shown during Play', () => {
    expect(plotOf(heat, 1, TIMES[1]).playhead).toBeCloseTo(mmAt(1)?.x ?? NaN, 6)
    expect(plot.playhead).toBeNull()
  })

  it('draws nothing without an evening orbit or room', () => {
    expect(heatPlot({ ...heat, evening: null }, { width: 336, errorScale: 1 })).toBeNull()
    expect(heatPlot(heat, { width: 40, errorScale: 1 })).toBeNull()
  })
})

describe('ticks', () => {
  it('steps by 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(18.9, 2)).toBe(10)
    expect(niceStep(9.6, 3)).toBe(5)
    expect(niceStep(5, 4)).toBe(1)
    expect(niceStep(0.5, 2)).toBe(0.2)
  })

  it('places ticks only inside the domain', () => {
    expect(ticksWithin({ lo: -2.1, hi: 7.5 }, 3)).toEqual([0, 5])
    expect(ticksWithin({ lo: 9.3, hi: 28.2 }, 2)).toEqual([10, 20])
  })
})
