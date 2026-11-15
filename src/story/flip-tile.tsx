import { type ReactNode, useEffect, useRef, useState } from 'react'
import { dataUrl } from '#web/data/load.ts'
import { EN } from '#web/i18n/en.ts'
import { selectStory, useStore } from '#web/state/store.ts'
import type { CloudTile, CoherenceTile, Heat, RadarTile, Tile } from '#web/story/chapters.ts'
import type { UnitRect } from '#web/story/crop.ts'
import { decodedImage, loadImage } from '#web/story/images.ts'
import { type ChangeKind, KIND_STYLE } from '#web/story/kinds.ts'
import {
  canvasPlan,
  type ChartPass,
  type ChartPoint,
  drawnOutline,
  type Face,
  heatGeometry,
  otherSide,
  type Side,
  sourceRect,
  tileFaces,
  tileFinePrint,
  tileKey,
  tileLegend,
  tilePaths,
} from '#web/story/tile.ts'
import { MOTION } from '#web/tokens.ts'
import { formatNumber, formatShortDate, withUnit } from '#web/ui/format.ts'
import { Icon } from '#web/ui/icon.tsx'
import { useReducedMotion } from '#web/ui/reduced-motion.ts'

export interface FlipTileProps {
  readonly tile: Tile
  readonly slug: string
  readonly timeZone: string
  readonly size: 'inset' | 'card'
  readonly kind?: ChangeKind
  readonly early?: boolean
  readonly children?: ReactNode
}

type ImageTileProps = Omit<FlipTileProps, 'tile'> & {
  readonly tile: RadarTile | CoherenceTile | CloudTile
}

type Loaded =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly images: ReadonlyMap<string, HTMLImageElement> }
  | { readonly status: 'error' }

const LOADING: Loaded = { status: 'loading' }
const MASK_ALPHA = 0.6
const OUTLINE_WIDTH = 2
const OUTLINE_EDGE_WIDTH = 5
const CHART_WIDTH = 300
const BAND_HEIGHT = 60
const CHART_PAD = 6
const LINE_WIDTH = 2
const DOT_RADIUS = 2.5
const GUIDE_DASH = '3 3'
const TEMPERATURE_DIGITS = 1
const PERCENT = 100
const HALF = 0.5

function decodedAll(slug: string, list: readonly string[]): Loaded {
  const entries = list.flatMap((path) => {
    const image = decodedImage(dataUrl(slug, path))
    return image === undefined ? [] : [[path, image] as const]
  })
  return entries.length === list.length ? { status: 'ready', images: new Map(entries) } : LOADING
}

function useImages(slug: string, paths: readonly string[]): Loaded {
  const key = paths.join('\n')
  const [loaded, setLoaded] = useState<{ readonly key: string; readonly state: Loaded }>({
    key: '',
    state: LOADING,
  })
  useEffect(() => {
    let live = true
    const list = key.split('\n')
    if (decodedAll(slug, list).status === 'ready') return
    Promise.all(list.map((path) => loadImage(dataUrl(slug, path)))).then(
      (images) => {
        const entries = list.flatMap((path, i) => {
          const image = images[i]
          return image === undefined ? [] : [[path, image] as const]
        })
        if (live) setLoaded({ key, state: { status: 'ready', images: new Map(entries) } })
      },
      () => {
        if (live) setLoaded({ key, state: { status: 'error' } })
      },
    )
    return () => {
      live = false
    }
  }, [slug, key])
  return loaded.key === key ? loaded.state : decodedAll(slug, key.split('\n'))
}

function Chip({ children, place }: { readonly children: ReactNode; readonly place: string }) {
  return (
    <span
      className={`absolute flex items-center gap-1 rounded-sm bg-panel px-1.5 py-0.5 tnum text-meta text-text-2 ${place}`}
    >
      {children}
    </span>
  )
}

function Outline({ rect, kind }: { readonly rect: UnitRect; readonly kind?: ChangeKind }) {
  const box = { x: rect.x, y: rect.y, width: rect.w, height: rect.h }
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        {...box}
        fill="none"
        strokeWidth={OUTLINE_EDGE_WIDTH}
        vectorEffect="non-scaling-stroke"
        className="stroke-ink"
      />
      <rect
        {...box}
        fill="none"
        strokeWidth={OUTLINE_WIDTH}
        vectorEffect="non-scaling-stroke"
        className={kind === undefined ? 'stroke-text' : KIND_STYLE[kind].stroke}
      />
    </svg>
  )
}

interface FaceLayerProps {
  readonly face: Face
  readonly images: ReadonlyMap<string, HTMLImageElement>
  readonly kind?: ChangeKind
  readonly hidden: boolean
}

function FaceLayer({ face, images, kind, hidden }: FaceLayerProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const image = images.get(face.path)
  const mask = face.mask === null ? undefined : images.get(face.mask)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d') ?? null
    if (element === null || context === null || image === undefined) return
    const rect = sourceRect(face.crop, image.naturalWidth, image.naturalHeight)
    const plan = canvasPlan(rect)
    element.width = plan.width
    element.height = plan.height
    context.imageSmoothingEnabled = plan.smooth
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, plan.width, plan.height)
    if (mask === undefined) return
    const onMask = sourceRect(face.maskCrop ?? face.crop, mask.naturalWidth, mask.naturalHeight)
    context.globalAlpha = face.maskOpaque === true ? 1 : MASK_ALPHA
    context.drawImage(mask, onMask.x, onMask.y, onMask.w, onMask.h, 0, 0, plan.width, plan.height)
    context.globalAlpha = 1
  }, [face.crop, face.maskCrop, face.maskOpaque, image, mask])
  if (image === undefined) return null
  const rect = sourceRect(face.crop, image.naturalWidth, image.naturalHeight)
  const outline = drawnOutline(face, image.naturalWidth, image.naturalHeight)
  return (
    <span className={`absolute inset-0 ${hidden ? 'opacity-0' : 'opacity-100'}`}>
      <canvas
        ref={canvas}
        className="block size-full"
        style={{ imageRendering: canvasPlan(rect).smooth ? 'auto' : 'pixelated' }}
      />
      {outline === null ? null : <Outline rect={outline} kind={kind} />}
      <Chip place="bottom-2 left-2">{face.label}</Chip>
    </span>
  )
}

function Failed() {
  return (
    <span className="absolute inset-0 flex items-center justify-center gap-2 p-3 text-meta text-text-2">
      <Icon name="warning" size={16} className="shrink-0 text-error" />
      {EN.tile.failed}
    </span>
  )
}

const BOX = 'relative block aspect-square w-full overflow-hidden rounded-sm bg-bg'
const CARD_BOX = `${BOX} short:max-w-36`
const FRAME = 'flex w-full flex-col gap-2'
const CAPTION = 'block text-meta text-text-3'

interface FrameProps {
  readonly size: FlipTileProps['size']
  readonly flip: string
  readonly caption: string
  readonly children: ReactNode
}

function TileFrame({ size, flip, caption, children }: FrameProps) {
  if (size === 'inset') {
    return (
      <span className={FRAME} data-flip={flip}>
        {children}
        <span className={CAPTION}>{caption}</span>
      </span>
    )
  }
  return (
    <figure className={FRAME} data-flip={flip}>
      {children}
      <figcaption className={CAPTION}>{caption}</figcaption>
    </figure>
  )
}

function ImageTile({ tile, slug, timeZone, size, kind, early, children }: ImageTileProps) {
  const faces = tileFaces(tile, timeZone)
  const loaded = useImages(slug, tilePaths(tile))
  const reduced = useReducedMotion()
  const pixelM = useStore((s) => selectStory(s)?.pixelM ?? null)
  const [side, setSide] = useState<Side>('before')
  const [stopped, setStopped] = useState(false)
  const flipping = loaded.status === 'ready' && !reduced && !stopped
  useEffect(() => {
    if (!flipping) return
    const id = window.setTimeout(() => {
      setSide(otherSide(side))
    }, MOTION.flipMs)
    return () => {
      window.clearTimeout(id)
    }
  }, [flipping, side])
  if (faces === null) return null
  const [before, after] = faces
  const box = size === 'card' ? CARD_BOX : BOX
  const alt = EN.tile.alt(before.label, after.label)
  const caption = [tileLegend(tile), tileFinePrint(tile, pixelM)]
    .filter((line) => line !== null)
    .join(' ')
  const layer = (face: Face, hidden: boolean) =>
    loaded.status === 'ready' ? (
      <FaceLayer face={face} images={loaded.images} kind={kind} hidden={hidden} />
    ) : null
  const tag = early === true ? <Chip place="top-2 left-2">{EN.card.early}</Chip> : null
  let picture: ReactNode
  if (loaded.status === 'error') {
    picture = (
      <span role="img" aria-label={alt} className={box}>
        <Failed />
      </span>
    )
  } else if (reduced) {
    picture = (
      <span role="img" aria-label={alt} className="relative grid w-full grid-cols-2 gap-1">
        {(
          [
            ['before', before],
            ['after', after],
          ] as const
        ).map(([which, face]) => (
          <span key={which} className={box}>
            {layer(face, false)}
          </span>
        ))}
        {tag}
      </span>
    )
  } else {
    const stack = (
      <>
        {layer(before, side !== 'before')}
        {layer(after, side !== 'after')}
        {tag}
        {stopped ? (
          <Chip place="top-2 right-2">
            <Icon name="pause" size={14} />
            {EN.tile.paused}
          </Chip>
        ) : null}
      </>
    )
    picture =
      size === 'card' ? (
        <button
          type="button"
          aria-label={`${alt} ${stopped ? EN.tile.resume : EN.tile.pause}`}
          onClick={() => {
            setStopped(!stopped)
          }}
          className={box}
        >
          {stack}
        </button>
      ) : (
        <span role="img" aria-label={alt} className={box}>
          {stack}
        </span>
      )
  }
  return (
    <TileFrame size={size} flip={flipping ? side : 'still'} caption={caption}>
      {picture}
      {children}
    </TileFrame>
  )
}

const plotX = (share: number) => CHART_PAD + share * (CHART_WIDTH - 2 * CHART_PAD)
const plotY = (share: number) => CHART_PAD + share * (BAND_HEIGHT - 2 * CHART_PAD)
const polyline = (points: readonly ChartPoint[]) =>
  points.map((p) => `${String(plotX(p.x))},${String(plotY(p.y))}`).join(' ')

interface BandProps {
  readonly points: readonly ChartPoint[]
  readonly guides: readonly number[]
  readonly zero: number | null
  readonly line: string
  readonly dot: string
}

function Band({ points, guides, zero, line, dot }: BandProps) {
  return (
    <svg
      viewBox={`0 0 ${String(CHART_WIDTH)} ${String(BAND_HEIGHT)}`}
      className="block w-full"
      aria-hidden="true"
    >
      {guides.map((x, i) => (
        <line
          key={i}
          x1={plotX(x)}
          x2={plotX(x)}
          y1={0}
          y2={BAND_HEIGHT}
          strokeDasharray={GUIDE_DASH}
          vectorEffect="non-scaling-stroke"
          className="stroke-control"
        />
      ))}
      {zero === null ? null : (
        <line
          x1={CHART_PAD}
          x2={CHART_WIDTH - CHART_PAD}
          y1={plotY(zero)}
          y2={plotY(zero)}
          vectorEffect="non-scaling-stroke"
          className="stroke-control"
        />
      )}
      <polyline
        points={polyline(points)}
        fill="none"
        strokeWidth={LINE_WIDTH}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={line}
      />
      {points.map((p) => (
        <circle key={p.x} cx={plotX(p.x)} cy={plotY(p.y)} r={DOT_RADIUS} className={dot} />
      ))}
    </svg>
  )
}

function PassLabel({ pass, timeZone }: { readonly pass: ChartPass; readonly timeZone: string }) {
  const date = formatShortDate(pass.time, timeZone)
  const text =
    pass.tempC === null
      ? date
      : EN.tile.chartPass(
          date,
          withUnit(formatNumber(pass.tempC, TEMPERATURE_DIGITS), EN.units.celsius),
        )
  const at = (plotX(pass.x) / CHART_WIDTH) * PERCENT
  const style = pass.x <= HALF ? { left: `${String(at)}%` } : { right: `${String(PERCENT - at)}%` }
  return (
    <span className="absolute top-0 whitespace-nowrap tnum text-meta text-text-2" style={style}>
      {text}
    </span>
  )
}

interface ChartTileProps {
  readonly heat: Heat
  readonly timeZone: string
  readonly size: FlipTileProps['size']
  readonly children?: ReactNode
}

function ChartTile({ heat, timeZone, size, children }: ChartTileProps) {
  const orbit = heat.evening
  const geometry = orbit === null ? null : heatGeometry(orbit)
  const first = orbit?.passes[0]
  const last = orbit?.passes.at(-1)
  const { kind } = heat.object
  return (
    <TileFrame size={size} flip="still" caption={EN.tile.chartFine}>
      {geometry === null || first === undefined || last === undefined ? null : (
        <span
          role="img"
          aria-label={EN.tile.chartAlt(
            EN.change.heat.noun[kind],
            formatShortDate(first.time, timeZone),
            formatShortDate(last.time, timeZone),
          )}
          className="flex w-full flex-col gap-1 rounded-sm bg-bg p-2"
        >
          <span className="text-meta text-text-3">{EN.tile.chartAir}</span>
          <Band
            points={geometry.air}
            guides={[geometry.hot.x, geometry.cold.x]}
            zero={null}
            line="stroke-control"
            dot="fill-control"
          />
          <span className="text-meta text-text-3">
            {EN.tile.chartMove(EN.change.heat.title[kind])}
          </span>
          <Band
            points={geometry.move}
            guides={[geometry.hot.x, geometry.cold.x]}
            zero={geometry.zero}
            line="stroke-text-2"
            dot="fill-text-2"
          />
          <span className="relative block h-5">
            <PassLabel pass={geometry.hot} timeZone={timeZone} />
            <PassLabel pass={geometry.cold} timeZone={timeZone} />
          </span>
        </span>
      )}
      {children}
    </TileFrame>
  )
}

export function FlipTile(props: FlipTileProps) {
  const { tile } = props
  if (tile.variant === 'chart') {
    return (
      <ChartTile key={tileKey(tile)} heat={tile.heat} timeZone={props.timeZone} size={props.size}>
        {props.children}
      </ChartTile>
    )
  }
  return <ImageTile key={tileKey(tile)} {...props} tile={tile} />
}
