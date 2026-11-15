import { dataUrl } from '#web/data/load.ts'
import { NISAR_REPEAT_DAYS } from '#web/data/nisar.ts'
import type {
  Corners,
  Ground,
  LonLatPair,
  PlaceData,
  StoryChapterRecord,
  StoryNumber,
  StoryOverlay,
  StorySeries,
} from '#web/data/types.ts'
import { applyAffine } from '#web/film/geo.ts'
import { EN } from '#web/i18n/en.ts'
import { imageAffine, type UnitRect } from '#web/story/crop.ts'
import { confidenceWord, directionWord } from '#web/story/story-text.ts'
import {
  formatDate,
  formatNumber,
  formatUpTo,
  formatUtcDate,
  formatUtcTime,
  withUnit,
} from '#web/ui/format.ts'

const GROUND_KIND = 'ground'
const CM_DIGITS = 1
const MM_PER_CM = 10
const WHOLE_IMAGE: UnitRect = { x: 0, y: 0, w: 1, h: 1 }

export interface GroundExample {
  readonly slug: string
  readonly ground: Ground
  readonly chapter: StoryChapterRecord
  readonly centre: StorySeries
  readonly firm: StorySeries
  readonly movedAway: StoryNumber
  readonly days: number
  readonly pairs: number
  readonly steadyPairs: number
  readonly hills: number
  readonly hillsMaxMm: number
}

export interface GroundOverlay {
  readonly url: string
  readonly image: Corners
  readonly crop: UnitRect
}

export interface GroundSource {
  readonly line: string
  readonly scenes: readonly string[]
  readonly district: string
}

export function groundExample(data: PlaceData): GroundExample | null {
  const ground = data.ground
  const chapter = data.story?.chapters.find((c) => c.kind === GROUND_KIND)
  if (ground === null || chapter === undefined) return null
  const [centre, firm] = chapter.chart?.series ?? []
  const { numbers } = chapter
  const movedAway = numbers.moved_away
  const days = numbers.days?.value
  const pairs = numbers.pairs?.value
  const steadyPairs = numbers.pairs_12_days?.value
  const hills = numbers.firm_hills?.value
  const hillsMaxMm = numbers.firm_hills_max_abs?.value
  if (
    centre === undefined ||
    firm === undefined ||
    movedAway === undefined ||
    days === undefined ||
    pairs === undefined ||
    steadyPairs === undefined ||
    hills === undefined ||
    hillsMaxMm === undefined
  ) {
    return null
  }
  const slug = data.slug
  return {
    slug,
    ground,
    chapter,
    centre,
    firm,
    movedAway,
    days,
    pairs,
    steadyPairs,
    hills,
    hillsMaxMm,
  }
}

const cmText = (cm: number, digits = CM_DIGITS): string =>
  withUnit(formatUpTo(cm, digits), EN.units.cm)

export const groundHeadline = (example: GroundExample): string =>
  EN.business.ground.headline(
    example.ground.district.name,
    cmText(example.movedAway.value),
    example.days,
  )

export function groundSentence(data: PlaceData): string | null {
  const example = groundExample(data)
  return example === null ? null : groundHeadline(example)
}

export const groundFacts = (example: GroundExample, timeZone: string): string =>
  EN.business.ground.facts(
    example.ground.district.name,
    formatDate(example.chapter.window.from, timeZone),
    formatDate(example.chapter.window.to, timeZone),
    confidenceWord(example.chapter.confidence),
  )

export const groundBecause = (example: GroundExample): string =>
  EN.business.ground.because(
    example.pairs,
    example.steadyPairs,
    NISAR_REPEAT_DAYS,
    example.hills,
    withUnit(formatNumber(Math.ceil(example.hillsMaxMm / MM_PER_CM)), EN.units.cm),
  )

export function groundMeta(example: GroundExample): string {
  const { ground, movedAway } = example
  const range = movedAway.range
  const lines = [
    ...(range === null
      ? []
      : [EN.business.ground.spread(formatNumber(range[0]), cmText(range[1], 0))]),
    EN.business.ground.lineOfSight(ground.reference.name),
    EN.business.ground.pixels(ground.pixel_m),
    ...(ground.atmosphere_corrected ? [] : [EN.business.ground.atmosphere]),
    EN.business.ground.notClaimed,
  ]
  return lines.join(' ')
}

export const groundKey = (example: GroundExample): string =>
  EN.business.ground.key(cmText(example.ground.map.max_cm, 0))

const share = (value: number): number => Math.min(1, Math.max(0, value))

function pointAt(corners: Corners, u: number, v: number): LonLatPair {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners
  const along = (a: LonLatPair, b: LonLatPair): LonLatPair => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
  ]
  const top = along(topLeft, topRight)
  const bottom = along(bottomLeft, bottomRight)
  return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v]
}

function cropTo(image: Corners, square: Corners): UnitRect {
  const affine = imageAffine(image)
  const points = square.map((corner) => applyAffine(affine, corner))
  const us = points.map(([u]) => share(u))
  const vs = points.map(([, v]) => share(v))
  const x = Math.min(...us)
  const y = Math.min(...vs)
  return { x, y, w: Math.max(...us) - x, h: Math.max(...vs) - y }
}

export function cropCorners(image: Corners, crop: UnitRect): Corners {
  const right = crop.x + crop.w
  const bottom = crop.y + crop.h
  return [
    pointAt(image, crop.x, crop.y),
    pointAt(image, right, crop.y),
    pointAt(image, right, bottom),
    pointAt(image, crop.x, bottom),
  ]
}

export function overlayOn(data: PlaceData, overlay: StoryOverlay): GroundOverlay {
  const image = overlay.corners_lonlat
  const square = data.radar?.corners_lonlat
  return {
    url: dataUrl(data.slug, overlay.image),
    image,
    crop: square === undefined ? WHOLE_IMAGE : cropTo(image, square),
  }
}

export function groundOverlay(data: PlaceData): GroundOverlay | null {
  const overlay = groundExample(data)?.chapter.overlay ?? null
  return overlay === null ? null : overlayOn(data, overlay)
}

export function groundSource(example: GroundExample): GroundSource | null {
  const { ground } = example
  const first = ground.pairs[0]
  const last = ground.pairs.at(-1)
  if (first === undefined || last === undefined) return null
  return {
    line: EN.business.ground.sourceLine(
      ground.product,
      ground.track,
      directionWord(ground.direction),
      formatUtcDate(first.from),
      formatUtcDate(last.to),
      formatUtcTime(first.from),
    ),
    scenes: ground.pairs.map((p) => p.scene),
    district: EN.business.ground.sourceDistrict(ground.district.osm),
  }
}
