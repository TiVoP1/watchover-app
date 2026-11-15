import { type PointerEvent, useState } from 'react'
import { EN } from '#web/i18n/en.ts'
import { type ChangeKind, KIND_STYLE } from '#web/story/kinds.ts'
import type { ToldChart as Chart } from '#web/story/place-story.ts'
import { nearestPoint, plotFrame, plotX, plotY, TOLD_PLOT } from '#web/story/told-plot.ts'
import { formatDate, formatUpTo, withUnit } from '#web/ui/format.ts'

export interface ToldChartProps {
  readonly chart: Chart
  readonly timeZone: string
  readonly kind: ChangeKind
}

const LINE_WIDTH = 2
const DOT_RADIUS = 3
const REFERENCE_DASH = '4 3'
const VALUE_DIGITS = 0

const strokeOf = (kind: ChangeKind, index: number) =>
  index === 0 ? KIND_STYLE[kind].stroke : 'stroke-text-2'

function Swatch({ kind, index }: { readonly kind: ChangeKind; readonly index: number }) {
  return (
    <svg viewBox="0 0 16 4" className="h-1 w-4 shrink-0" aria-hidden="true">
      <line
        x1={0}
        x2={16}
        y1={2}
        y2={2}
        strokeWidth={LINE_WIDTH}
        strokeDasharray={index === 0 ? undefined : REFERENCE_DASH}
        className={strokeOf(kind, index)}
      />
    </svg>
  )
}

interface VisitTableProps {
  readonly chart: Chart
  readonly timeZone: string
  readonly value: (v: number) => string
}

function VisitTable({ chart, timeZone, value }: VisitTableProps) {
  const [lead] = chart.series
  if (lead === undefined) return null
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th scope="col">{EN.told.tableDay}</th>
          {chart.series.map((s) => (
            <th key={s.label} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lead.points.map((point) => (
          <tr key={point.time}>
            <td>{formatDate(point.time, timeZone)}</td>
            {chart.series.map((s) => {
              const at = s.points.find((p) => p.time === point.time)
              return <td key={s.label}>{at === undefined ? null : value(at.value)}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ToldChart({ chart, timeZone, kind }: ToldChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const frame = plotFrame(chart.series)
  const [lead] = chart.series
  const firstPoint = lead?.points[0]
  const lastPoint = lead?.points.at(-1)
  if (frame === null || lead === undefined || firstPoint === undefined || lastPoint === undefined) {
    return null
  }
  const value = (v: number) => withUnit(formatUpTo(v, VALUE_DIGITS), chart.unit)
  const at = hover === null ? null : lead.points[hover]
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / Math.max(1, box.width)) * TOLD_PLOT.width
    setHover(nearestPoint(frame, lead.points, x))
  }
  return (
    <figure className="flex w-full flex-col gap-1 rounded-sm bg-bg p-2">
      <figcaption className="text-meta text-text-3">{EN.told.chartUnit(chart.unit)}</figcaption>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <span className="flex flex-col justify-between py-0.5 text-right tnum text-meta text-text-3">
          <span>{formatUpTo(frame.high, 0)}</span>
          <span>{formatUpTo(frame.low, 0)}</span>
        </span>
        <svg
          viewBox={`0 0 ${String(TOLD_PLOT.width)} ${String(TOLD_PLOT.height)}`}
          className="block w-full touch-none"
          role="img"
          aria-label={EN.told.chartAlt(
            formatDate(firstPoint.time, timeZone),
            formatDate(lastPoint.time, timeZone),
          )}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHover(null)
          }}
        >
          <line
            x1={TOLD_PLOT.pad}
            x2={TOLD_PLOT.width - TOLD_PLOT.pad}
            y1={plotY(frame, 0)}
            y2={plotY(frame, 0)}
            vectorEffect="non-scaling-stroke"
            className="stroke-control"
          />
          {at === null || at === undefined ? null : (
            <line
              x1={plotX(frame, at.time)}
              x2={plotX(frame, at.time)}
              y1={0}
              y2={TOLD_PLOT.height}
              vectorEffect="non-scaling-stroke"
              className="stroke-line"
            />
          )}
          {chart.series.map((s, index) => (
            <g key={s.label}>
              <polyline
                points={s.points
                  .map((p) => `${String(plotX(frame, p.time))},${String(plotY(frame, p.value))}`)
                  .join(' ')}
                fill="none"
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeDasharray={index === 0 ? undefined : REFERENCE_DASH}
                vectorEffect="non-scaling-stroke"
                className={strokeOf(kind, index)}
              />
              {s.points.slice(-1).map((p) => (
                <circle
                  key={p.time}
                  cx={plotX(frame, p.time)}
                  cy={plotY(frame, p.value)}
                  r={DOT_RADIUS}
                  className={index === 0 ? KIND_STYLE[kind].fill : 'fill-text-2'}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <span className="flex justify-between pl-6 tnum text-meta text-text-3">
        <span>{formatDate(firstPoint.time, timeZone)}</span>
        <span>{formatDate(lastPoint.time, timeZone)}</span>
      </span>
      <ul className="mt-1 flex flex-col gap-0.5">
        {chart.series.map((s, index) => {
          const shown = hover === null ? s.points.at(-1) : s.points[hover]
          return (
            <li key={s.label} className="flex items-center gap-2 tnum text-meta text-text-2">
              <Swatch kind={kind} index={index} />
              <span className="min-w-0 flex-1">{s.label}</span>
              {shown === undefined ? null : <span className="text-text">{value(shown.value)}</span>}
            </li>
          )
        })}
      </ul>
      <p className="tnum text-meta text-text-3" aria-live="polite">
        {formatDate((at ?? lastPoint).time, timeZone)}
      </p>
      <VisitTable chart={chart} timeZone={timeZone} value={value} />
    </figure>
  )
}
