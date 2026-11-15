import type { GroundExample } from '#web/business/ground.ts'
import {
  type Column,
  domainOf,
  type MonthTick,
  monthTicks,
  type Tick,
  ticksWithin,
} from '#web/business/heat-plot.ts'

export interface GroundPoint {
  readonly index: number
  readonly time: string
  readonly x: number
  readonly y: number
  readonly value: number
}

export interface GroundPlot {
  readonly width: number
  readonly height: number
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly zero: number
  readonly ticks: readonly Tick[]
  readonly centre: readonly GroundPoint[]
  readonly firm: readonly GroundPoint[]
  readonly months: readonly MonthTick[]
  readonly columns: readonly Column[]
}

interface GroundLayout {
  readonly left: number
  readonly right: number
  readonly height: number
  readonly plot: readonly [top: number, bottom: number]
}

export const GROUND_LAYOUT: GroundLayout = {
  left: 32,
  right: 12,
  height: 204,
  plot: [32, 176],
}

const DOT_INSET_PX = 8
const TICK_GAP_PX = 28
const MONTH_GAP_PX = 44
const MIN_SPAN_CM = 4

interface Row {
  readonly index: number
  readonly time: string
  readonly ms: number
  readonly centre: number
  readonly firm: number
}

function spaced(months: readonly MonthTick[]): MonthTick[] {
  const kept: MonthTick[] = []
  for (const month of months) {
    const previous = kept.at(-1)
    if (previous === undefined || month.x - previous.x >= MONTH_GAP_PX) kept.push(month)
  }
  return kept
}

function rowsOf(example: GroundExample): Row[] {
  const { centre, firm } = example
  return centre.dates.flatMap((time, index) => {
    const c = centre.values[index]
    const f = firm.values[index]
    const ms = Date.parse(time)
    return c === undefined || f === undefined || Number.isNaN(ms)
      ? []
      : [{ index, time, ms, centre: c, firm: f }]
  })
}

export function groundPlot(example: GroundExample, width: number): GroundPlot | null {
  const { left, right, height, plot } = GROUND_LAYOUT
  const [top, bottom] = plot
  const x0 = left + DOT_INSET_PX
  const x1 = width - right - DOT_INSET_PX
  const rows = rowsOf(example)
  const first = rows[0]
  const last = rows.at(-1)
  if (x1 <= x0 || first === undefined || last === undefined || rows.length < 2) return null
  const x = (ms: number) => x0 + ((ms - first.ms) / Math.max(1, last.ms - first.ms)) * (x1 - x0)
  const domain = domainOf([0, ...rows.flatMap((r) => [r.centre, r.firm])], MIN_SPAN_CM)
  const y = (cm: number) => bottom - ((cm - domain.lo) / (domain.hi - domain.lo)) * (bottom - top)
  const points = (pick: (r: Row) => number): GroundPoint[] =>
    rows.map((r) => ({ index: r.index, time: r.time, x: x(r.ms), y: y(pick(r)), value: pick(r) }))
  const xs = rows.map((r) => x(r.ms))
  const columns = rows.map((r, i) => {
    const at = xs[i] ?? x0
    return {
      index: r.index,
      from: i === 0 ? left : (at + (xs[i - 1] ?? at)) / 2,
      to: i === rows.length - 1 ? width - right : (at + (xs[i + 1] ?? at)) / 2,
    }
  })
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    zero: y(0),
    ticks: ticksWithin(domain, Math.floor((bottom - top) / TICK_GAP_PX)).map((value) => ({
      value,
      y: y(value),
    })),
    centre: points((r) => r.centre),
    firm: points((r) => r.firm),
    months: spaced(monthTicks(first.ms, last.ms).map((time) => ({ time, x: x(Date.parse(time)) }))),
    columns,
  }
}
