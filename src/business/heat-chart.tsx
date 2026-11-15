import { useState } from 'react'
import { nounOf } from '#web/business/copy.ts'
import { heatPlot, type HeatPlot, LAYOUT, type PlotPoint } from '#web/business/heat-plot.ts'
import { selectErrorScale } from '#web/business/motion.ts'
import { EN } from '#web/i18n/en.ts'
import { useStore } from '#web/state/store.ts'
import type { Heat, HeatOrbit } from '#web/story/chapters.ts'
import { temperatureText } from '#web/story/story-text.ts'
import { useViewSize } from '#web/tools/view-size.ts'
import {
  formatDate,
  formatMonth,
  formatNumber,
  formatSigned,
  formatUpTo,
  withUnit,
} from '#web/ui/format.ts'

export interface HeatChartProps {
  readonly heat: Heat
  readonly timeZone: string
  readonly at?: string | null
}

const LABEL_ABOVE_PX = 9
const LABEL_SIDE_PX = 9
const LABEL_LEFT_SHARE = 0.6
const LABEL_EDGE_PX = 28
const LABEL_HALO_PX = 4
const LABEL_BASELINE_PX = 4
const TICK_LABEL_GAP_PX = 6
const AXIS_TITLE_BASELINE_PX = 13
const AXIS_TITLE_GAP_PX = 24
const MONTH_BASELINE_FROM_BOTTOM_PX = 6
const DOT_R = 4
const BAR_OPACITY = 0.55

const polyline = (points: readonly PlotPoint[]) =>
  points.map((p) => `${String(p.x)},${String(p.y)}`).join(' ')

function errorOf(orbit: HeatOrbit, errorScale: number): number | null {
  return orbit.hotColdErrMm === null ? null : orbit.hotColdErrMm * errorScale
}

function mmValue(orbit: HeatOrbit, index: number, mm: number, errorScale: number): string {
  const err = errorOf(orbit, errorScale)
  const value = formatSigned(mm, 1)
  return withUnit(
    err === null || index === orbit.cold
      ? value
      : EN.business.plusMinus(value, formatNumber(err, 1)),
    EN.units.mm,
  )
}

function labelSpot(point: PlotPoint, plot: HeatPlot, above: boolean) {
  if (above) {
    const anchor =
      point.x < plot.left + LABEL_EDGE_PX
        ? 'start'
        : point.x > plot.width - plot.right - LABEL_EDGE_PX
          ? 'end'
          : 'middle'
    return { x: point.x, y: point.y - LABEL_ABOVE_PX, anchor } as const
  }
  const left = point.x > plot.width * LABEL_LEFT_SHARE
  return {
    x: point.x + (left ? -LABEL_SIDE_PX : LABEL_SIDE_PX),
    y: point.y + LABEL_BASELINE_PX,
    anchor: left ? 'end' : 'start',
  } as const
}

function ValueLabel({
  point,
  plot,
  text,
  above,
}: {
  readonly point: PlotPoint | undefined
  readonly plot: HeatPlot
  readonly text: string
  readonly above: boolean
}) {
  if (point === undefined) return null
  const spot = labelSpot(point, plot, above)
  return (
    <text
      x={spot.x}
      y={spot.y}
      textAnchor={spot.anchor}
      strokeWidth={LABEL_HALO_PX}
      strokeLinejoin="round"
      paintOrder="stroke"
      className="fill-text-2 stroke-panel text-meta tnum"
    >
      {text}
    </text>
  )
}

function StripLine({
  plot,
  x,
  className,
}: {
  readonly plot: HeatPlot
  readonly x: number | undefined
  readonly className: string
}) {
  if (x === undefined) return null
  return [plot.temperature, plot.mm].map((strip) => (
    <line key={strip.top} x1={x} x2={x} y1={strip.top} y2={strip.bottom} className={className} />
  ))
}

function Ticks({ plot }: { readonly plot: HeatPlot }) {
  return [plot.temperature, plot.mm].flatMap((strip, s) =>
    strip.ticks.map((tick) => (
      <g key={`${String(s)}-${String(tick.value)}`}>
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
          {formatUpTo(tick.value, 1)}
        </text>
      </g>
    )),
  )
}

function Series({ points }: { readonly points: readonly PlotPoint[] }) {
  return (
    <g>
      <polyline
        points={polyline(points)}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-ev-ground"
      />
      {points.map((p) => (
        <circle
          key={p.time}
          cx={p.x}
          cy={p.y}
          r={DOT_R}
          strokeWidth={2}
          className="fill-ev-ground stroke-panel"
        />
      ))}
    </g>
  )
}

function Plot({
  plot,
  heat,
  timeZone,
  hover,
  onHover,
}: {
  readonly plot: HeatPlot
  readonly heat: Heat
  readonly timeZone: string
  readonly hover: number | null
  readonly onHover: (index: number | null) => void
}) {
  const evening = heat.evening
  if (evening === null) return null
  const at = (points: readonly PlotPoint[], index: number | null) =>
    index === null ? undefined : points.find((p) => p.index === index)
  const hotC = at(plot.temperature.evening, plot.hot)
  const coldC = at(plot.temperature.evening, plot.cold)
  const hoveredPoint = at(plot.mm.evening, hover)
  return (
    <>
      <text x={0} y={AXIS_TITLE_BASELINE_PX} className="fill-text-3 text-meta">
        {EN.business.axisTemperature}
      </text>
      <text x={0} y={plot.mm.top - AXIS_TITLE_GAP_PX} className="fill-text-3 text-meta">
        {EN.business.axisMm}
      </text>
      <Ticks plot={plot} />
      <line
        x1={plot.left}
        x2={plot.width - plot.right}
        y1={plot.mm.zero}
        y2={plot.mm.zero}
        className="stroke-control"
      />
      <StripLine plot={plot} x={hotC?.x} className="stroke-control" />
      <StripLine plot={plot} x={coldC?.x} className="stroke-control" />
      <StripLine plot={plot} x={hoveredPoint?.x} className="stroke-text-2" />
      <StripLine plot={plot} x={plot.playhead ?? undefined} className="stroke-text" />
      {plot.mm.bars.map((bar) => (
        <line
          key={bar.x}
          x1={bar.x}
          x2={bar.x}
          y1={bar.top}
          y2={bar.bottom}
          strokeWidth={1.5}
          strokeOpacity={BAR_OPACITY}
          className="stroke-ev-ground"
        />
      ))}
      <Series points={plot.temperature.evening} />
      <Series points={plot.mm.evening} />
      <ValueLabel
        point={hotC}
        plot={plot}
        above
        text={hotC === undefined ? '' : temperatureText(hotC.value)}
      />
      <ValueLabel
        point={coldC}
        plot={plot}
        above={false}
        text={coldC === undefined ? '' : temperatureText(coldC.value)}
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
          y={plot.temperature.top}
          width={Math.max(0, column.to - column.from)}
          height={plot.mm.bottom - plot.temperature.top}
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
  heat,
  plot,
  hover,
  timeZone,
  errorScale,
}: {
  readonly heat: Heat
  readonly plot: HeatPlot
  readonly hover: number | null
  readonly timeZone: string
  readonly errorScale: number
}) {
  const evening = heat.evening
  const pass = hover === null ? undefined : evening?.passes[hover]
  if (
    hover === null ||
    evening === null ||
    pass === undefined ||
    pass.losMmFromColdest === null ||
    pass.tempC === null
  ) {
    const widened = errorScale !== 1 && plot.mm.bars.length > 0
    return (
      <p className="mt-1 min-h-5 text-meta text-text-3">
        {widened ? EN.business.errorsWidened(formatNumber(errorScale, 1)) : null}
      </p>
    )
  }
  return (
    <p className="mt-1 min-h-5 tnum text-meta text-text-2">
      {EN.business.readout(
        formatDate(pass.time, timeZone),
        temperatureText(pass.tempC),
        mmValue(evening, hover, pass.losMmFromColdest, errorScale),
      )}
    </p>
  )
}

function PassTable({
  heat,
  timeZone,
  errorScale,
}: {
  readonly heat: Heat
  readonly timeZone: string
  readonly errorScale: number
}) {
  const evening = heat.evening
  if (evening === null) return null
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th scope="col">{EN.business.table.day}</th>
          <th scope="col">{EN.business.table.temperature}</th>
          <th scope="col">{EN.business.table.mm}</th>
        </tr>
      </thead>
      <tbody>
        {evening.passes.map((pass, index) => (
          <tr key={pass.time}>
            <td>{formatDate(pass.time, timeZone)}</td>
            <td>{pass.tempC === null ? null : temperatureText(pass.tempC)}</td>
            <td>
              {pass.losMmFromColdest === null
                ? null
                : mmValue(evening, index, pass.losMmFromColdest, errorScale)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function HeatChart({ heat, timeZone, at = null }: HeatChartProps) {
  const [box, view] = useViewSize()
  const [hover, setHover] = useState<number | null>(null)
  const errorScale = useStore(selectErrorScale)
  const width = view === null ? 0 : Math.floor(view.width)
  const plot = width > 0 ? heatPlot(heat, { width, errorScale, at }) : null
  const name = heat.object.name ?? nounOf(heat.object)
  return (
    <figure className="m-0">
      <div ref={box} className="w-full">
        <svg
          className="block w-full overflow-visible"
          height={LAYOUT.height}
          viewBox={plot === null ? undefined : `0 0 ${String(plot.width)} ${String(plot.height)}`}
          role="img"
          aria-label={EN.business.chart(name)}
          onPointerLeave={() => {
            setHover(null)
          }}
        >
          {plot === null ? null : (
            <Plot plot={plot} heat={heat} timeZone={timeZone} hover={hover} onHover={setHover} />
          )}
        </svg>
      </div>
      {plot !== null ? (
        <Readout
          heat={heat}
          plot={plot}
          hover={hover}
          timeZone={timeZone}
          errorScale={errorScale}
        />
      ) : null}
      <PassTable heat={heat} timeZone={timeZone} errorScale={errorScale} />
    </figure>
  )
}
