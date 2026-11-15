import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { dataUrl } from '#web/data/load.ts'
import type { RadarMeta } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { selectZone, useStore } from '#web/state/store.ts'
import { loadImage } from '#web/story/images.ts'
import type { LonLat } from '#web/story/where.ts'
import { MOTION } from '#web/tokens.ts'
import {
  buildSchedule,
  cropPixels,
  leftLabel,
  plateText,
  type SharpenLayout,
  type SharpenStack,
  sharpenLayout,
  sharpenStack,
  sharpenTarget,
  type Size,
  stepAt,
  targetShare,
} from '#web/tools/sharpen.ts'
import { ToolPlate } from '#web/tools/tool-plate.tsx'
import { useViewSize } from '#web/tools/view-size.ts'
import { Icon } from '#web/ui/icon.tsx'
import { prefersReducedMotion } from '#web/ui/reduced-motion.ts'

type Phase = 'loading' | 'flying' | 'building' | 'ready' | 'error'

const LEFT_HALF = 'inset(0 50% 0 0)'
const RIGHT_HALF = 'inset(0 0 0 50%)'

interface HalfProps {
  readonly src: string
  readonly clip: string
  readonly layout: SharpenLayout
  readonly transform: string | null
  readonly animate: boolean
}

function Half({ src, clip, layout, transform, animate }: HalfProps) {
  return (
    <div className="absolute inset-0" style={{ clipPath: clip }}>
      <div
        className={`absolute inset-0 origin-top-left ${animate ? 'transition-transform duration-(--dur-fly) ease-ui' : ''}`}
        style={transform === null ? undefined : { transform }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
            imageRendering: 'pixelated',
          }}
        />
      </div>
    </div>
  )
}

interface SplitProps {
  readonly slug: string
  readonly radar: RadarMeta
  readonly stack: SharpenStack
  readonly target: LonLat
  readonly zone: string
}

function SharpenSplit({ slug, radar, stack, target, zone }: SplitProps) {
  const [ref, view] = useViewSize()
  const [reduced] = useState(prefersReducedMotion)
  const [image, setImage] = useState<Size | null>(null)
  const [failed, setFailed] = useState(false)
  const [flown, setFlown] = useState(false)
  const [building, setBuilding] = useState(false)
  const [built, setBuilt] = useState(false)
  const [handed, setHanded] = useState(false)
  const [index, setIndex] = useState(() => (reduced ? stack.steps.length - 1 : 0))
  const urls = useMemo(() => stack.steps.map((s) => dataUrl(slug, s.frame)), [slug, stack])
  const loaded = image !== null && view !== null

  useEffect(() => {
    let live = true
    Promise.all(urls.map(loadImage)).then(
      (images) => {
        const first = images[0]
        if (live && first !== undefined) {
          setImage({ width: first.naturalWidth, height: first.naturalHeight })
        }
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [urls])

  useEffect(() => {
    if (!loaded || reduced) return
    let frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => {
        setFlown(true)
      })
    })
    const timer = window.setTimeout(() => {
      setBuilding(true)
    }, MOTION.flyMs)
    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(timer)
    }
  }, [loaded, reduced])

  useEffect(() => {
    if (!building || handed) return
    const last = stack.steps.length - 1
    const timers = buildSchedule(stack.steps.length, MOTION.sharpenStepMs).map((s) =>
      window.setTimeout(() => {
        setIndex(s.index)
        if (s.index === last) setBuilt(true)
      }, s.atMs),
    )
    return () => {
      timers.forEach((t) => {
        window.clearTimeout(t)
      })
    }
  }, [building, handed, stack])

  const phase: Phase = failed
    ? 'error'
    : !loaded
      ? 'loading'
      : reduced || built || handed
        ? 'ready'
        : building
          ? 'building'
          : 'flying'
  const step = stepAt(stack, index)
  const layout =
    image === null || view === null
      ? null
      : sharpenLayout(view, image, targetShare(radar, target), cropPixels(radar, image))

  return (
    <section
      ref={ref}
      aria-label={EN.tools.sharpenTitle}
      data-sharpen-status={phase}
      data-sharpen-looks={step.looks}
      className={`absolute inset-0 overflow-hidden ${phase === 'loading' ? '' : 'bg-bg'}`}
    >
      {phase === 'loading' ? (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-text-3" aria-label={EN.tools.loading} />
      ) : null}
      {phase === 'error' ? (
        <p className="absolute inset-0 flex items-center justify-center gap-2 text-body text-text">
          <Icon name="warning" size={20} className="text-error" />
          {EN.tools.loadError}
        </p>
      ) : null}
      {layout === null || phase === 'loading' || phase === 'error' ? null : (
        <>
          <Half
            src={urls[0] ?? ''}
            clip={LEFT_HALF}
            layout={layout}
            transform={reduced || flown ? null : layout.overview}
            animate={flown}
          />
          <Half
            src={urls[index] ?? ''}
            clip={RIGHT_HALF}
            layout={layout}
            transform={reduced || flown ? null : layout.overview}
            animate={flown}
          />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-text" />
          <p className="absolute top-3 left-3 rounded-sm bg-panel px-2 py-1 tnum text-meta text-text-2">
            {leftLabel(stack, zone)}
          </p>
          <p className="absolute top-3 right-3 flex items-baseline gap-2 rounded-sm bg-panel px-3 py-1">
            <span className="tnum text-figure">{step.looks}</span>
            <span className="text-card font-semibold text-text-2">
              {EN.tools.averagedWords(step.looks)}
            </span>
          </p>
          <div className="absolute right-3 bottom-3 w-72 rounded-md border border-line bg-panel px-3 py-2">
            <p className="text-meta text-text-3">{EN.tools.finePrint}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="tnum text-meta text-text-3">{stack.first.looks}</span>
              <input
                type="range"
                min={0}
                max={stack.steps.length - 1}
                step={1}
                value={index}
                onChange={(e) => {
                  setHanded(true)
                  setIndex(Number(e.target.value))
                }}
                aria-label={EN.tools.slider}
                aria-valuetext={EN.tools.averaged(step.looks)}
                className="min-w-0 flex-1"
              />
              <span className="tnum text-meta text-text-3">{stack.last.looks}</span>
            </div>
          </div>
          <ToolPlate
            lines={[plateText(stack, index, zone)]}
            attribution={EN.tools.radarAttribution}
          />
        </>
      )}
    </section>
  )
}

export function SharpenView(): ReactNode {
  const place = useStore((s) => s.place)
  const zone = useStore(selectZone)
  const data = place.status === 'ready' ? place.data : null
  const stack = useMemo(() => sharpenStack(data?.radar ?? null), [data])
  const target = useMemo(() => (data === null ? null : sharpenTarget(data)), [data])
  if (data === null || data.radar === null || stack === null || target === null) return null
  return (
    <SharpenSplit
      key={data.slug}
      slug={data.slug}
      radar={data.radar}
      stack={stack}
      target={target}
      zone={zone}
    />
  )
}
