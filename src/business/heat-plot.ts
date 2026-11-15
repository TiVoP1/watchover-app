import type { Heat, HeatOrbit } from '#web/story/chapters.ts'

export interface PlotPoint {
  readonly index: number
  readonly time: string
  readonly x: number
  readonly y: number
  readonly value: number
}

export interface ErrorBar {
  readonly x: number
  readonly top: number
  readonly bottom: number
}

export interface Tick {
  readonly y: number
  readonly value: number
}

export interface Strip {
  readonly top: number
  readonly bottom: number
  readonly ticks: readonly Tick[]
  readonly evening: readonly PlotPoint[]
}

export interface MmStrip extends Strip {
  readonly zero: number
  readonly bars: readonly ErrorBar[]
}

export interface Column {
  readonly index: number
  readonly from: number
  readonly to: number
}

export interface MonthTick {
  readonly x: number
  readonly time: string
}

export interface HeatPlot {
  readonly width: number
  readonly height: number
  readonly left: number
  readonly right: number
  readonly temperature: Strip
  readonly mm: MmStrip
  readonly hot: number | null
  readonly cold: number | null
  readonly months: readonly MonthTick[]
  readonly columns: readonly Column[]
  readonly playhead: number | null
}

export interface PlotOptions {
  readonly width: number
  readonly errorScale: number
  readonly at?: string | null
}

interface Layout {
  readonly left: number
  readonly right: number
  readonly height: number
  readonly temperature: readonly [top: number, bottom: number]
  readonly mm: readonly [top: number, bottom: number]
}

export const LAYOUT: Layout = {
  left: 32,
  right: 12,
  height: 236,
  temperature: [40, 84],
  mm: [144, 212],
}

const DOT_INSET_PX = 8
const TICK_GAP_PX = 20
const PAD_SHARE = 0.04
const MIN_SPAN_C = 4
const MIN_SPAN_MM = 2
const MONTH_TICK_HOUR_UTC = 12

export interface Domain {
  readonly lo: number
  readonly hi: number
}

export function domainOf(values: readonly number[], minSpan: number): Domain {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const grow = Math.max(0, minSpan - (max - min)) / 2
  const pad = Math.max(max - min, minSpan) * PAD_SHARE
  return { lo: min - grow - pad, hi: max + grow + pad }
}

export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * magnitude
}

function nextStep(step: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(step))
  const norm = Math.round(step / magnitude)
  return (norm === 1 ? 2 : norm === 2 ? 5 : 10) * magnitude
}

export function ticksWithin({ lo, hi }: Domain, count: number): number[] {
  let step = niceStep(hi - lo, count)
  while (Math.floor(hi / step) - Math.ceil(lo / step) + 1 > Math.max(1, count)) {
    step = nextStep(step)
  }
  const ticks: number[] = []
  for (let n = Math.ceil(lo / step); n * step <= hi; n++) ticks.push(n === 0 ? 0 : n * step)
  return ticks
}

export function monthTicks(from: number, to: number): string[] {
  const start = new Date(from)
  const months: string[] = []
  for (let m = 0; ; m++) {
    const t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1, MONTH_TICK_HOUR_UTC)
    if (t > to) return months
    if (t > from) months.push(new Date(t).toISOString())
  }
}

const withMm = (orbit: HeatOrbit) =>
  orbit.passes.flatMap((p, index) =>
    p.losMmFromColdest === null ? [] : [{ index, time: p.time, value: p.losMmFromColdest }],
  )

const withTemperature = (orbit: HeatOrbit) =>
  orbit.passes.flatMap((p, index) =>
    p.tempC === null ? [] : [{ index, time: p.time, value: p.tempC }],
  )

export function heatPlot(heat: Heat, options: PlotOptions): HeatPlot | null {
  const evening = heat.evening
  const layout = LAYOUT
  const { width, errorScale } = options
  const x0 = layout.left + DOT_INSET_PX
  const x1 = width - layout.right - DOT_INSET_PX
  if (evening === null || x1 <= x0) return null
  const eveningMm = withMm(evening)
  const eveningC = withTemperature(evening)
  if (eveningMm.length < 2 || eveningC.length < 2) return null
  const err = evening.hotColdErrMm === null ? null : evening.hotColdErrMm * errorScale
  const barred = err === null ? [] : eveningMm.filter((p) => p.index !== evening.cold)
  const times = [...eveningMm, ...eveningC].map((p) => Date.parse(p.time))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const x = (time: string) => x0 + ((Date.parse(time) - t0) / Math.max(1, t1 - t0)) * (x1 - x0)
  const temperatureDomain = domainOf(
    eveningC.map((p) => p.value),
    MIN_SPAN_C,
  )
  const mmDomain = domainOf(
    [
      0,
      ...eveningMm.map((p) => p.value),
      ...barred.flatMap((p) => (err === null ? [] : [p.value - err, p.value + err])),
    ],
    MIN_SPAN_MM,
  )
  const scale =
    ([top, bottom]: readonly [number, number], { lo, hi }: Domain) =>
    (value: number) =>
      bottom - ((value - lo) / (hi - lo)) * (bottom - top)
  const yC = scale(layout.temperature, temperatureDomain)
  const yMm = scale(layout.mm, mmDomain)
  const points = (
    list: readonly { index: number; time: string; value: number }[],
    y: (v: number) => number,
  ) => list.map((p) => ({ ...p, x: x(p.time), y: y(p.value) }))
  const ticks = (band: readonly [number, number], domain: Domain, y: (v: number) => number) =>
    ticksWithin(domain, Math.floor((band[1] - band[0]) / TICK_GAP_PX)).map((value) => ({
      value,
      y: y(value),
    }))
  const evenX = eveningMm.map((p) => ({ index: p.index, x: x(p.time) }))
  const columns = evenX.map((p, i) => ({
    index: p.index,
    from: i === 0 ? layout.left : (p.x + (evenX[i - 1]?.x ?? p.x)) / 2,
    to: i === evenX.length - 1 ? width - layout.right : (p.x + (evenX[i + 1]?.x ?? p.x)) / 2,
  }))
  const at = options.at ?? null
  return {
    width,
    height: layout.height,
    left: layout.left,
    right: layout.right,
    temperature: {
      top: layout.temperature[0],
      bottom: layout.temperature[1],
      ticks: ticks(layout.temperature, temperatureDomain, yC),
      evening: points(eveningC, yC),
    },
    mm: {
      top: layout.mm[0],
      bottom: layout.mm[1],
      ticks: ticks(layout.mm, mmDomain, yMm),
      evening: points(eveningMm, yMm),
      zero: yMm(0),
      bars: barred.flatMap((p) =>
        err === null ? [] : [{ x: x(p.time), top: yMm(p.value + err), bottom: yMm(p.value - err) }],
      ),
    },
    hot: evening.passes[evening.hot] === undefined ? null : evening.hot,
    cold: evening.passes[evening.cold] === undefined ? null : evening.cold,
    months: monthTicks(t0, t1).map((time) => ({ time, x: x(time) })),
    columns,
    playhead: at === null ? null : Math.min(x1, Math.max(x0, x(at))),
  }
}
