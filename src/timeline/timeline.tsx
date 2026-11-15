import { type PointerEvent, useEffect, useMemo, useState } from 'react'
import { EN } from '#web/i18n/en.ts'
import { selectZone, useStore } from '#web/state/store.ts'
import { type ChangeKind, KIND_STYLE } from '#web/story/kinds.ts'
import { missingDays } from '#web/story/story-text.ts'
import { buildAxis, nearestIndex, spread, tintsAllKinds } from '#web/timeline/axis.ts'
import { followPlayback } from '#web/timeline/playback.ts'
import { TEXT_PX } from '#web/tokens.ts'
import { formatDateTime, formatMonth, formatMonthYear, formatShortDate } from '#web/ui/format.ts'
import { Icon } from '#web/ui/icon.tsx'

const PAD_PX = 16
const GAP_PX = 128
const LABEL_OFFSET_PX = 4
const CHAR_EM = 0.5
const TITLE_Y = 16
const DISC_Y = 27
const DISC_R = 10
const DISC_SPACING_PX = 30
const RING_R = 14
const GLYPH_PX = 12
const HIT_SLOP_PX = 3
const HEAD_TOP = 42
const TICK_TOP = 46
const TICK_BOTTOM = 66
const HEAD_BOTTOM = 70
const GAP_TITLE_Y = 55
const GAP_DATES_Y = 71
const MONTH_LINE_TOP = 82
const MONTH_Y = 94
const MONTH_LINE_BOTTOM = 98
const MARK_Y = TICK_BOTTOM - 4
const MARK_INSET_PX = 3
const MARK_PX = 9

const breakMark = (x: number) => `M${x} ${MARK_Y}l4 -12M${x + 5} ${MARK_Y}l4 -12`

const NEUTRAL = KIND_STYLE.heat

const tintOf = (kind: ChangeKind): string | null =>
  KIND_STYLE[kind].fill === NEUTRAL.fill ? null : KIND_STYLE[kind].fill

function keyTarget(key: string, frame: number, last: number): number | null {
  if (key === 'ArrowRight') return Math.min(last, frame + 1)
  if (key === 'ArrowLeft') return Math.max(0, frame - 1)
  if (key === 'Home') return 0
  if (key === 'End') return last
  return null
}

function useWidth(): [(element: SVGSVGElement | null) => void, number] {
  const [element, setElement] = useState<SVGSVGElement | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element])
  return [setElement, width]
}

export function Timeline() {
  useEffect(() => followPlayback(), [])
  const place = useStore((s) => s.place)
  const panel = useStore((s) => s.panel)
  const mode = useStore((s) => s.mode)
  const frame = useStore((s) => s.frame)
  const chapter = useStore((s) => s.chapter)
  const item = useStore((s) => s.item)
  const holding = useStore((s) => s.gap)
  const setFrame = useStore((s) => s.setFrame)
  const zone = useStore(selectZone)
  const [ref, width] = useWidth()

  const model = useMemo(() => {
    if (place.status !== 'ready') return null
    const frames = place.data.radar?.frames ?? []
    if (frames.length === 0) return null
    const { chapters, gap } = place.story
    const axis = buildAxis(
      frames.map((f) => Date.parse(f.time)),
      gap === null ? null : { from: Date.parse(gap.from), to: Date.parse(gap.to) },
      {
        width,
        padPx: PAD_PX,
        gapPx: GAP_PX,
        labelOffsetPx: LABEL_OFFSET_PX,
        charPx: TEXT_PX.meta * CHAR_EM,
        monthName: (at, withYear) =>
          withYear
            ? formatMonthYear(new Date(at).toISOString(), zone)
            : formatMonth(new Date(at), zone),
      },
    )
    const ticks = chapters.map((c) => axis.ticks[c.frame] ?? PAD_PX)
    const discs = spread(ticks, DISC_SPACING_PX, PAD_PX + DISC_R, width - PAD_PX - DISC_R)
    const markers = chapters.map((c, i) => ({
      chapter: c,
      tickX: ticks[i] ?? PAD_PX,
      discX: discs[i] ?? PAD_PX,
    }))
    const missing = gap === null ? null : missingDays(gap)
    const gapDates =
      missing === null
        ? null
        : EN.timeline.gapDates(
            formatShortDate(missing.from, zone),
            formatShortDate(missing.to, zone),
          )
    const tinted = tintsAllKinds(chapters.map((c) => tintOf(c.kind)))
    return { frames, axis, markers, gapDates, tinted }
  }, [place, width, zone])

  if (panel === 'orbit') {
    return (
      <footer className="flex h-28 shrink-0 items-center justify-center border-t border-line bg-panel">
        <p className="text-meta text-text-3">{EN.timeline.waiting}</p>
      </footer>
    )
  }
  if (model === null) return <footer className="h-28 shrink-0 border-t border-line bg-panel" />

  const { frames, axis, markers, gapDates, tinted } = model
  const last = frames.length - 1
  const people = mode === 'people'
  const lit = people
    ? (chapter ?? markers.find((m) => panel === 'story' && m.chapter.id === item)?.chapter.n)
    : null
  const head = axis.ticks[frame] ?? PAD_PX
  const pass = frames[frame]

  const target = (e: PointerEvent<SVGSVGElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const disc = people
      ? markers.find((m) => Math.hypot(m.discX - x, DISC_Y - y) <= DISC_R + HIT_SLOP_PX)
      : undefined
    return disc?.chapter.frame ?? nearestIndex(axis.ticks, x)
  }

  return (
    <footer className="relative h-28 shrink-0 border-t border-line bg-panel">
      <svg
        ref={ref}
        className="h-full w-full cursor-pointer touch-none select-none"
        role="slider"
        tabIndex={0}
        aria-label={EN.timeline.label}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={frame}
        aria-valuetext={pass === undefined ? '' : formatDateTime(pass.time, zone)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setFrame(target(e))
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return
          const next = target(e)
          if (next !== frame) setFrame(next)
        }}
        onKeyDown={(e) => {
          const next = keyTarget(e.key, frame, last)
          if (next === null) return
          e.preventDefault()
          e.stopPropagation()
          setFrame(next)
        }}
      >
        {width === 0 ? null : (
          <>
            <text x={PAD_PX} y={TITLE_Y} className="fill-text-3 font-cond text-meta">
              {EN.timeline.label}
            </text>
            {axis.lines.map((x) => (
              <line
                key={`line${x}`}
                x1={x}
                x2={x}
                y1={MONTH_LINE_TOP}
                y2={MONTH_LINE_BOTTOM}
                className="stroke-line"
              />
            ))}
            {axis.labels.map((label) => (
              <text
                key={`label${label.x}`}
                x={label.x}
                y={MONTH_Y}
                className="tnum fill-text-3 font-cond text-meta"
              >
                {label.text}
              </text>
            ))}
            {axis.gap === null || gapDates === null ? null : (
              <g className={holding ? 'fill-text-2 stroke-text-2' : 'fill-text-3 stroke-control'}>
                <path
                  d={`${breakMark(axis.gap.from + MARK_INSET_PX)}${breakMark(axis.gap.to - MARK_INSET_PX - MARK_PX)}`}
                  fill="none"
                  strokeWidth={1.5}
                />
                <text
                  x={(axis.gap.from + axis.gap.to) / 2}
                  y={GAP_TITLE_Y}
                  textAnchor="middle"
                  stroke="none"
                  className="font-cond text-meta"
                >
                  {EN.timeline.gap}
                </text>
                <text
                  x={(axis.gap.from + axis.gap.to) / 2}
                  y={GAP_DATES_Y}
                  textAnchor="middle"
                  stroke="none"
                  className="tnum font-cond text-meta"
                >
                  {gapDates}
                </text>
              </g>
            )}
            {axis.ticks.map((x, i) => (
              <line
                key={frames[i]?.time ?? i}
                x1={x}
                x2={x}
                y1={TICK_TOP}
                y2={TICK_BOTTOM}
                strokeWidth={i === frame ? 3 : 1.5}
                className={i === frame ? 'stroke-accent' : 'stroke-control'}
              />
            ))}
            <line
              x1={head}
              x2={head}
              y1={HEAD_TOP}
              y2={HEAD_BOTTOM}
              strokeWidth={2}
              className="stroke-accent"
            />
            {people
              ? markers.map(({ chapter: c, tickX, discX }) => {
                  const kind = KIND_STYLE[c.kind]
                  const style =
                    tinted || c.n === lit
                      ? kind
                      : {
                          ...kind,
                          fill: NEUTRAL.fill,
                          stroke: NEUTRAL.stroke,
                          glyph: NEUTRAL.glyph,
                        }
                  return (
                    <g key={c.id}>
                      <line
                        x1={discX}
                        x2={tickX}
                        y1={DISC_Y + DISC_R}
                        y2={TICK_TOP}
                        strokeWidth={1.5}
                        className={style.stroke}
                      />
                      <circle
                        cx={discX}
                        cy={DISC_Y}
                        r={DISC_R}
                        strokeWidth={1.5}
                        className={`${style.fill} stroke-ink`}
                      />
                      <g transform={`translate(${discX - GLYPH_PX / 2} ${DISC_Y - GLYPH_PX / 2})`}>
                        <Icon name={style.icon} size={GLYPH_PX} className={style.glyph} />
                      </g>
                      {c.n === lit ? (
                        <circle
                          cx={discX}
                          cy={DISC_Y}
                          r={RING_R}
                          strokeWidth={2}
                          className="fill-none stroke-text"
                        />
                      ) : null}
                    </g>
                  )
                })
              : null}
          </>
        )}
      </svg>
    </footer>
  )
}
