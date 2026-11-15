import { useState } from 'react'
import type { GroundExample } from '#web/business/ground.ts'
import {
  GROUND_LAYOUT,
  type GroundPlot,
  type GroundPoint,
  groundPlot,
} from '#web/business/ground-plot.ts'
import { EN } from '#web/i18n/en.ts'
import { useViewSize } from '#web/tools/view-size.ts'
import { formatDate, formatMonth, formatUpTo, withUnit } from '#web/ui/format.ts'

export interface GroundChartProps {
  readonly example: GroundExample
  readonly timeZone: string
}

const CM_DIGITS = 0
const AXIS_TITLE_BASELINE_PX = 13
const TICK_LABEL_GAP_PX = 6
const LABEL_BASELINE_PX = 4
const SERIES_LABEL_GAP_PX = 8
const SERIES_LABEL_DROP_PX = 16
const LABEL_HALO_PX = 4
const MONTH_BASELINE_FROM_BOTTOM_PX = 6
const DOT_R = 4

const polyline = (points: readonly GroundPoint[]) =>
  points.map((p) => `${String(p.x)},${String(p.y)}`).join(' ')

const cmText = (cm: number) => withUnit(formatUpTo(cm, CM_DIGITS), EN.units.cm)

function SeriesLabel({
  point,
  text,
  below,
}: {
  readonly point: GroundPoint | undefined
  readonly text: string
  readonly below: boolean
}) {
  if (point === undefined) return null
  return (
    <text
      x={point.x}
      y={below ? point.y + SERIES_LABEL_DROP_PX : point.y - SERIES_LABEL_GAP_PX}
      textAnchor="end"
      strokeWidth={LABEL_HALO_PX}
      strokeLinejoin="round"
      paintOrder="stroke"
      className="fill-text-2 stroke-panel text-meta"
    >
      {text}
    </text>
  )
}

function Plot({
  plot,
  example,
  timeZone,
  hover,
  onHover,
}: {
  readonly plot: GroundPlot
  readonly example: GroundExample
  readonly timeZone: string
  readonly hover: number | null
  readonly onHover: (index: number | null) => void
}) {
  const centreEnd = plot.centre.at(-1)
  const firmEnd = plot.firm.at(-1)
  const centreBelow = centreEnd !== undefined && firmEnd !== undefined && centreEnd.y > firmEnd.y
  const hovered =
    hover === null
      ? []
      : [plot.centre, plot.firm].flatMap((s) => s.filter((p) => p.index === hover))
  const guide = hovered[0]?.x
  return (
    <>
      <text x={0} y={AXIS_TITLE_BASELINE_PX} className="fill-text-3 text-meta">
        {EN.business.ground.axis}
      </text>
      {plot.ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={plot.left}
            x2={plot.width - plot.right}
            y1={tick.y}
            y2={tick.y}
            className="stroke-line"
          />
          <text
            x={plot.left - TICK_LABEL_GAP_PX}
            y={tick.y + LABEL_BASELINE_PX}
            textAnchor="end"
            className="fill-text-3 text-meta tnum"
          >
            {formatUpTo(tick.value, CM_DIGITS)}
          </text>
        </g>
      ))}
      <line
        x1={plot.left}
        x2={plot.width - plot.right}
        y1={plot.zero}
        y2={plot.zero}
        className="stroke-control"
      />
      {guide === undefined ? null : (
        <line x1={guide} x2={guide} y1={plot.top} y2={plot.bottom} className="stroke-text-2" />
      )}
      <polyline
        points={polyline(plot.firm)}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-text-3"
      />
      <polyline
        points={polyline(plot.centre)}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-ev-ground"
      />
      {hovered.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={DOT_R}
          strokeWidth={2}
          className={i === 0 ? 'fill-ev-ground stroke-panel' : 'fill-text-3 stroke-panel'}
        />
      ))}
      <SeriesLabel
        point={centreEnd}
        text={EN.business.ground.centre(example.ground.district.name)}
        below={centreBelow}
      />
      <SeriesLabel
        point={firmEnd}
        text={EN.business.ground.firm(example.hills)}
        below={!centreBelow}
      />
      {plot.months.map((month) => (
        <text
          key={month.time}
          x={month.x}
          y={plot.height - MONTH_BASELINE_FROM_BOTTOM_PX}
          textAnchor="middle"
          className="fill-text-3 text-meta"
        >
          {formatMonth(new Date(month.time), timeZone)}
        </text>
      ))}
      {plot.columns.map((column) => (
        <rect
          key={column.index}
          x={column.from}
          y={plot.top}
          width={Math.max(0, column.to - column.from)}
          height={plot.bottom - plot.top}
          fill="transparent"
          onPointerEnter={() => {
            onHover(column.index)
          }}
        />
      ))}
    </>
  )
}

function Readout({
  example,
  hover,
  timeZone,
}: {
  readonly example: GroundExample
  readonly hover: number | null
  readonly timeZone: string
}) {
  const time = hover === null ? undefined : example.centre.dates[hover]
  const centre = hover === null ? undefined : example.centre.values[hover]
  const firm = hover === null ? undefined : example.firm.values[hover]
  return (
    <p className="mt-1 min-h-5 tnum text-meta text-text-2">
      {time === undefined || centre === undefined || firm === undefined
        ? null
        : EN.business.ground.readout(formatDate(time, timeZone), cmText(centre), cmText(firm))}
    </p>
  )
}

function PassTable({ example, timeZone }: GroundChartProps) {
  const district = example.ground.district.name
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th scope="col">{EN.business.table.day}</th>
          <th scope="col">{EN.business.ground.centre(district)}</th>
          <th scope="col">{EN.business.ground.firm(example.hills)}</th>
        </tr>
      </thead>
      <tbody>
        {example.centre.dates.map((time, index) => {
          const centre = example.centre.values[index]
          const firm = example.firm.values[index]
          return (
            <tr key={time}>
              <td>{formatDate(time, timeZone)}</td>
              <td>{centre === undefined ? null : cmText(centre)}</td>
              <td>{firm === undefined ? null : cmText(firm)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function GroundChart({ example, timeZone }: GroundChartProps) {
  const [box, view] = useViewSize()
  const [hover, setHover] = useState<number | null>(null)
  const width = view === null ? 0 : Math.floor(view.width)
  const plot = width > 0 ? groundPlot(example, width) : null
  return (
    <figure className="m-0">
      <div ref={box} className="w-full">
        <svg
          className="block w-full overflow-visible"
          height={GROUND_LAYOUT.height}
          viewBox={plot === null ? undefined : `0 0 ${String(plot.width)} ${String(plot.height)}`}
          role="img"
          aria-label={EN.business.ground.chart(example.ground.district.name)}
          onPointerLeave={() => {
            setHover(null)
          }}
        >
          {plot === null ? null : (
            <Plot
              plot={plot}
              example={example}
              timeZone={timeZone}
              hover={hover}
              onHover={setHover}
            />
          )}
        </svg>
      </div>
      <Readout example={example} hover={hover} timeZone={timeZone} />
      <PassTable example={example} timeZone={timeZone} />
    </figure>
  )
}
