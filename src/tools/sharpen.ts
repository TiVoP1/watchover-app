import { type OrbitPart, orbitPart } from '#web/data/nisar.ts'
import type { PlaceData, RadarMeta, SharpenStep } from '#web/data/types.ts'
import { applyAffine } from '#web/film/geo.ts'
import { EN } from '#web/i18n/en.ts'
import { placeBySlug } from '#web/places.ts'
import { groundSizeM, imageAffine } from '#web/story/crop.ts'
import type { LonLat } from '#web/story/where.ts'
import { formatDate } from '#web/ui/format.ts'

export const SHARPEN_CROP_M = 3000
export const MIN_SCREEN_PX_PER_IMAGE_PX = 3
export const MAX_SCREEN_PX_PER_IMAGE_PX = 4
const OVERVIEW_SHARE = 0.92

export interface SharpenStack {
  readonly steps: readonly SharpenStep[]
  readonly first: SharpenStep
  readonly last: SharpenStep
  readonly track: number
  readonly part: OrbitPart
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Share {
  readonly u: number
  readonly v: number
}

export interface SharpenLayout {
  readonly scale: number
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly overview: string
}

export interface BuildStep {
  readonly index: number
  readonly atMs: number
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export function sharpenStack(radar: RadarMeta | null): SharpenStack | null {
  if (radar === null) return null
  const steps = [...radar.sharpen.steps].sort((a, b) => a.looks - b.looks)
  const pass = radar.frames.find((f) => f.track === radar.sharpen.track)
  const first = steps[0]
  const last = steps[steps.length - 1]
  if (first === undefined || last === undefined || first === last || first.looks !== 1) return null
  if (pass === undefined) return null
  return { steps, first, last, track: radar.sharpen.track, part: orbitPart(pass.direction) }
}

export const stepAt = (stack: SharpenStack, index: number): SharpenStep =>
  stack.steps[clamp(Math.round(index), 0, stack.steps.length - 1)] ?? stack.last

export const sharpenTarget = (data: PlaceData): LonLat =>
  placeBySlug(data.slug).sharpenTarget ?? [data.catalog.place.lon, data.catalog.place.lat]

export function targetShare(radar: RadarMeta, target: LonLat): Share {
  const [u, v] = applyAffine(imageAffine(radar.corners_lonlat), target)
  return { u: clamp(u, 0, 1), v: clamp(v, 0, 1) }
}

export function cropPixels(radar: RadarMeta, image: Size): number {
  const pixelM = groundSizeM(radar.corners_lonlat).heightM / image.height
  return Math.round(SHARPEN_CROP_M / pixelM)
}

export const screenScale = (viewHeightPx: number, cropPx: number): number =>
  clamp(Math.floor(viewHeightPx / cropPx), MIN_SCREEN_PX_PER_IMAGE_PX, MAX_SCREEN_PX_PER_IMAGE_PX)

export function sharpenLayout(
  view: Size,
  image: Size,
  target: Share,
  cropPx: number,
): SharpenLayout {
  const scale = screenScale(view.height, cropPx)
  const width = image.width * scale
  const height = image.height * scale
  const left = view.width / 2 - target.u * width
  const top = view.height / 2 - target.v * height
  const fit =
    (OVERVIEW_SHARE * Math.min(view.width, view.height)) / Math.max(image.width, image.height)
  const k = fit / scale
  const dx = (view.width - image.width * fit) / 2 - k * left
  const dy = (view.height - image.height * fit) / 2 - k * top
  return { scale, left, top, width, height, overview: `matrix(${k}, 0, 0, ${k}, ${dx}, ${dy})` }
}

export const buildSchedule = (count: number, stepMs: number): readonly BuildStep[] =>
  Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({
    index: i + 1,
    atMs: (i + 1) * stepMs,
  }))

export const leftLabel = (stack: SharpenStack, timeZone: string): string =>
  EN.tools.onePass(formatDate(stack.first.until, timeZone))

export function plateText(stack: SharpenStack, index: number, timeZone: string): string {
  const step = stepAt(stack, index)
  return EN.tools.stackPlate(
    step.looks,
    EN.tools.part[stack.part],
    stack.track,
    formatDate(stack.first.until, timeZone),
    formatDate(step.until, timeZone),
  )
}
