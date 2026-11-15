import type { ToldPoint, ToldSeries } from '#web/story/place-story.ts'

export const TOLD_PLOT = { width: 300, height: 120, pad: 6 } as const

export interface PlotFrame {
  readonly first: number
  readonly last: number
  readonly low: number
  readonly high: number
}

export function plotFrame(series: readonly ToldSeries[]): PlotFrame | null {
  const points = series.flatMap((s) => s.points)
  if (points.length < 2) return null
  const times = points.map((p) => Date.parse(p.time))
  const values = points.map((p) => p.value)
  const low = Math.floor(Math.min(0, ...values))
  return {
    first: Math.min(...times),
    last: Math.max(...times),
    low,
    high: Math.max(low + 1, Math.ceil(Math.max(0, ...values))),
  }
}

export const plotX = (frame: PlotFrame, time: string): number =>
  TOLD_PLOT.pad +
  ((Date.parse(time) - frame.first) / Math.max(1, frame.last - frame.first)) *
    (TOLD_PLOT.width - 2 * TOLD_PLOT.pad)

export const plotY = (frame: PlotFrame, value: number): number =>
  TOLD_PLOT.pad +
  ((frame.high - value) / (frame.high - frame.low)) * (TOLD_PLOT.height - 2 * TOLD_PLOT.pad)

export function nearestPoint(frame: PlotFrame, points: readonly ToldPoint[], x: number): number {
  const gaps = points.map((p) => Math.abs(plotX(frame, p.time) - x))
  return gaps.indexOf(Math.min(...gaps))
}
