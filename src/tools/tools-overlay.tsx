import { useState } from 'react'
import { dataUrl } from '#web/data/load.ts'
import { EN } from '#web/i18n/en.ts'
import { selectItem, selectZone, useStore } from '#web/state/store.ts'
import type { UnitRect } from '#web/story/crop.ts'
import type { ChangeKind } from '#web/story/kinds.ts'
import { type CloudsPair, cloudsPair, type SplitImage } from '#web/tools/clouds.ts'
import { SharpenView } from '#web/tools/sharpen-view.tsx'
import { ToolPlate } from '#web/tools/tool-plate.tsx'
import { useViewSize } from '#web/tools/view-size.ts'
import { formatDate, formatUtcDate, formatUtcTime } from '#web/ui/format.ts'
import { Icon } from '#web/ui/icon.tsx'

const SPLIT_START_PCT = 50
const PERCENT = 100

const BORDER: Readonly<Record<ChangeKind, string>> = {
  frost: 'border-ev-snow',
  forest: 'border-ev-forest',
  fields: 'border-ev-fields',
  water: 'border-ev-water',
  rework: 'border-ev-built',
  heat: 'border-text-2',
  ground: 'border-ev-ground',
  volcano: 'border-ev-ground',
  quake: 'border-ev-ground',
  flood: 'border-ev-water',
  other: 'border-text-2',
}

const pct = (share: number) => `${share * PERCENT}%`

interface LayerProps {
  readonly src: string
  readonly image: SplitImage
  readonly pixelated: boolean
  readonly clip: string | null
}

function Layer({ src, image, pixelated, clip }: LayerProps) {
  const { crop } = image
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={clip === null ? undefined : { clipPath: clip }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{
          left: pct(-crop.x / crop.w),
          top: pct(-crop.y / crop.h),
          width: pct(1 / crop.w),
          height: pct(1 / crop.h),
          imageRendering: pixelated ? 'pixelated' : undefined,
        }}
      />
    </div>
  )
}

function ChangeMark({ outline, kind }: { readonly outline: UnitRect; readonly kind: ChangeKind }) {
  return (
    <>
      <div
        className={`pointer-events-none absolute border-2 outline-1 outline-ink ${BORDER[kind]}`}
        style={{
          left: pct(outline.x),
          top: pct(outline.y),
          width: pct(outline.w),
          height: pct(outline.h),
        }}
      />
      <div
        className="pointer-events-none absolute size-10 -translate-1/2 rounded-full border-2 border-text outline-1 outline-ink"
        style={{ left: pct(outline.x + outline.w / 2), top: pct(outline.y + outline.h / 2) }}
      />
    </>
  )
}

interface CloudsSplitProps {
  readonly slug: string
  readonly pair: CloudsPair
  readonly zone: string
}

function CloudsSplit({ slug, pair, zone }: CloudsSplitProps) {
  const [split, setSplit] = useState(SPLIT_START_PCT)
  return (
    <>
      <Layer src={dataUrl(slug, pair.radar.path)} image={pair.radar} pixelated clip={null} />
      <Layer
        src={dataUrl(slug, pair.photo.path)}
        image={pair.photo}
        pixelated={false}
        clip={`inset(0 ${PERCENT - split}% 0 0)`}
      />
      {pair.outline === null || pair.kind === null ? null : (
        <ChangeMark outline={pair.outline} kind={pair.kind} />
      )}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-text"
        style={{ left: `${split}%` }}
      />
      <input
        type="range"
        min={0}
        max={PERCENT}
        step={1}
        value={split}
        onChange={(e) => {
          setSplit(Number(e.target.value))
        }}
        aria-label={EN.tools.cloudsSplit}
        aria-valuetext={EN.tools.cloudsSplitValue(split)}
        className="peer absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
      <span
        className="pointer-events-none absolute top-3/4 flex size-8 -translate-1/2 items-center justify-center rounded-full border border-control bg-panel text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
        style={{ left: `${split}%` }}
      >
        <Icon name="caret-left" size={14} />
        <Icon name="caret-right" size={14} />
      </span>
      <p className="pointer-events-none absolute top-3 left-3 rounded-sm bg-panel px-2 py-1 tnum text-meta text-text-2">
        {EN.tools.cloudsPhoto(formatDate(pair.photoTime, zone), pair.cloudPct)}
      </p>
      <p className="pointer-events-none absolute top-3 right-3 rounded-sm bg-panel px-2 py-1 tnum text-meta text-text-2">
        {EN.tools.cloudsRadar(formatDate(pair.pass.time, zone))}
      </p>
      <ToolPlate
        lines={[
          EN.tools.radarSource(
            formatUtcDate(pair.pass.time),
            formatUtcTime(pair.pass.time),
            pair.pass.track,
            EN.tools.direction[pair.pass.direction],
            pair.pixelM,
          ),
          EN.tools.photoSource(pair.photoSource),
        ]}
        attribution={EN.tools.cloudsAttribution}
      />
    </>
  )
}

function CloudsView() {
  const place = useStore((s) => s.place)
  const frame = useStore((s) => s.frame)
  const item = useStore(selectItem)
  const zone = useStore(selectZone)
  const [ref, view] = useViewSize()
  if (place.status !== 'ready') return null
  const aspect = view === null || view.height === 0 ? 1 : view.width / view.height
  const pair = cloudsPair(place.data, frame, item, aspect)
  if (pair === null) return null
  return (
    <section
      ref={ref}
      aria-label={EN.tools.cloudsTitle}
      data-tool="clouds"
      className="absolute inset-0 overflow-hidden bg-bg"
    >
      {view === null ? null : (
        <CloudsSplit
          key={`${pair.photo.path}|${pair.radar.path}`}
          slug={place.data.slug}
          pair={pair}
          zone={zone}
        />
      )}
    </section>
  )
}

export function ToolsOverlay() {
  const tool = useStore((s) => s.tool)
  if (tool === 'sharpen') return <SharpenView />
  if (tool === 'clouds') return <CloudsView />
  return null
}
