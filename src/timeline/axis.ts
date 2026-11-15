export interface Span {
  readonly from: number
  readonly to: number
}

export interface AxisOptions {
  readonly width: number
  readonly padPx: number
  readonly gapPx: number
  readonly labelOffsetPx: number
  readonly charPx: number
  readonly monthName: (midMonth: number, withYear: boolean) => string
}

export interface MonthLabel {
  readonly x: number
  readonly text: string
}

export interface Axis {
  readonly ticks: readonly number[]
  readonly gap: Span | null
  readonly lines: readonly number[]
  readonly labels: readonly MonthLabel[]
}

interface Month {
  readonly from: number
  readonly to: number
  readonly mid: number
  readonly year: number
}

const MID_DAY = 15
const MID_HOUR = 12
const GAP_MAX_SHARE = 1 / 3
export const MAX_KIND_COLOURS = 4

export const tintsAllKinds = (tints: readonly (string | null)[]): boolean =>
  new Set(tints.filter((tint) => tint !== null)).size <= MAX_KIND_COLOURS

export function timeScale(
  start: number,
  end: number,
  gap: Span | null,
  from: number,
  to: number,
  gapPx: number,
): (t: number) => number {
  const gapMs = gap === null ? 0 : gap.to - gap.from
  const linearMs = end - start - gapMs
  const rate = linearMs > 0 ? (to - from - (gap === null ? 0 : gapPx)) / linearMs : 0
  return (t) => {
    if (gap === null || t <= gap.from) return from + (t - start) * rate
    const left = from + (gap.from - start) * rate
    if (t >= gap.to) return left + gapPx + (t - gap.to) * rate
    return left + ((t - gap.from) / gapMs) * gapPx
  }
}

function monthsBetween(start: number, end: number): Month[] {
  const first = new Date(start)
  const year = first.getUTCFullYear()
  let month = first.getUTCMonth()
  let from = Date.UTC(year, month, 1)
  const months: Month[] = []
  while (from <= end) {
    const to = Date.UTC(year, month + 1, 1)
    months.push({
      from,
      to,
      mid: Date.UTC(year, month, MID_DAY, MID_HOUR),
      year: new Date(from).getUTCFullYear(),
    })
    month += 1
    from = to
  }
  return months
}

export function buildAxis(
  ascendingTimes: readonly number[],
  gap: Span | null,
  options: AxisOptions,
): Axis {
  const start = ascendingTimes[0] ?? 0
  const end = ascendingTimes.at(-1) ?? start
  const from = options.padPx
  const to = Math.max(from, options.width - options.padPx)
  const cut = gap !== null && gap.from >= start && gap.to <= end && gap.to > gap.from ? gap : null
  const gapPx = cut === null ? 0 : Math.min(options.gapPx, (to - from) * GAP_MAX_SHARE)
  const x = timeScale(start, end, cut, from, to, gapPx)
  const segments: readonly Span[] =
    cut === null
      ? [{ from: start, to: end }]
      : [
          { from: start, to: cut.from },
          { from: cut.to, to: end },
        ]
  const lines: number[] = []
  const labels: MonthLabel[] = []
  let labelled: number | null = null
  for (const month of monthsBetween(start, end)) {
    for (const segment of segments) {
      const lo = Math.max(month.from, segment.from)
      const hi = Math.min(month.to, segment.to)
      if (lo >= hi) continue
      if (month.from > start && month.from >= segment.from) lines.push(x(month.from))
      const labelX = x(lo) + options.labelOffsetPx
      const text = options.monthName(month.mid, month.year !== labelled)
      if (labelX + text.length * options.charPx > x(hi)) continue
      labels.push({ x: labelX, text })
      labelled = month.year
    }
  }
  return {
    ticks: ascendingTimes.map(x),
    gap: cut === null ? null : { from: x(cut.from), to: x(cut.to) },
    lines,
    labels,
  }
}

export function spread(
  ascendingXs: readonly number[],
  minGap: number,
  lo: number,
  hi: number,
): number[] {
  interface Group {
    readonly size: number
    readonly sum: number
    readonly left: number
  }
  const place = (size: number, sum: number): Group => {
    const span = (size - 1) * minGap
    const left = Math.min(Math.max(sum / size - span / 2, lo), Math.max(lo, hi - span))
    return { size, sum, left }
  }
  const groups: Group[] = []
  for (const x of ascendingXs) {
    let group = place(1, x)
    let previous = groups.at(-1)
    while (
      previous !== undefined &&
      group.left - (previous.left + (previous.size - 1) * minGap) < minGap
    ) {
      groups.pop()
      group = place(previous.size + group.size, previous.sum + group.sum)
      previous = groups.at(-1)
    }
    groups.push(group)
  }
  return groups.flatMap((g) => Array.from({ length: g.size }, (_, i) => g.left + i * minGap))
}

export function nearestIndex(xs: readonly number[], x: number): number {
  let best = 0
  let distance = Infinity
  for (const [i, value] of xs.entries()) {
    const d = Math.abs(value - x)
    if (d < distance) {
      best = i
      distance = d
    }
  }
  return best
}
