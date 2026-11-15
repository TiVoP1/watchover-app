import { NISAR_REPEAT_DAYS } from '#web/data/nisar.ts'
import type {
  BBox,
  Corners,
  Ground,
  MeasuredPair,
  PassRef,
  PlaceData,
  PlaceStory,
  RadarFrame,
  StoryChapterRecord,
  StoryNumber,
  StoryPass,
} from '#web/data/types.ts'
import { applyAffine, fitAffine } from '#web/film/geo.ts'
import { EN } from '#web/i18n/en.ts'
import { placeBySlug } from '#web/places.ts'
import {
  backgroundFrame,
  type Chapter,
  frameAt,
  type PassList,
  type RadarTile,
  type Story,
  type StoryItem,
  type TileMap,
} from '#web/story/chapters.ts'
import { bboxRect, clipToWindow, cropAround, type UnitRect } from '#web/story/crop.ts'
import type { ToldKind } from '#web/story/kinds.ts'
import { type LonLat, viewPart, type Where, whereFrom } from '#web/story/where.ts'
import {
  formatDate,
  formatMonthYear,
  formatNumber,
  formatShortDate,
  formatUpTo,
  withUnit,
} from '#web/ui/format.ts'

export const MIN_PLAY_SPAN_DAYS = 270

const DAY_MS = 86_400_000
const WIDE_SHARE = 0.5
const RANGE_STEPS = 10
const ROUNDING_STEPS = [100, 10, 1] as const
const FINEST_STEP = 0.1
const SIGNIFICANT_DIGITS = 2
const MM_PER_CM = 10
const PER_CM: Readonly<Partial<Record<string, number>>> = { mm: MM_PER_CM, cm: 1 }

export interface ToldValues {
  readonly n: (name: string, unit: string) => string
  readonly v: (name: string, unit: string) => string
  readonly cmUp: (name: string, unit: string) => string
  readonly before: string
  readonly after: string
  readonly beforeYear: string
  readonly afterYear: string
  readonly from: string
  readonly toMonth: string
  readonly repeatDays: number
}

export interface ToldPoint {
  readonly time: string
  readonly value: number
}

export interface ToldSeries {
  readonly label: string
  readonly points: readonly ToldPoint[]
}

export interface ToldChart {
  readonly unit: string
  readonly series: readonly ToldSeries[]
}

export interface Told {
  readonly title: string
  readonly sentence: string
  readonly because: string
  readonly businessBecause: string
  readonly notClaimed: string
  readonly key: string
  readonly range: string | null
  readonly caveats: readonly string[]
  readonly chart: ToldChart | null
  readonly measured: readonly MeasuredPair[]
  readonly scenes: readonly string[]
  readonly attribution: string | null
}

export interface ToldSummary {
  readonly short: string
  readonly long: string
}

export type ToldItem = Extract<StoryItem, { readonly told: Told }>

type ChapterText = keyof typeof EN.told.chapter
type SummaryText = keyof typeof EN.told.summary
type AttributionText = keyof typeof EN.told.attribution

interface ChapterSpec {
  readonly key: readonly [name: string, unit: string]
  readonly keyShownAs: 'value' | 'range'
  readonly keyMeasured: boolean
  readonly measuredBy: 'GCOV' | 'GUNW'
  readonly overlay: 'map' | 'mask'
  readonly text: ChapterText
}

interface PlaceSpec {
  readonly summary: SummaryText
  readonly attribution: readonly AttributionText[]
  readonly chapters: readonly ChapterSpec[]
}

const SPECS: Readonly<Partial<Record<string, PlaceSpec>>> = {
  'mexico-city': {
    summary: 'mexico',
    attribution: ['district'],
    chapters: [
      {
        key: ['moved_away', 'cm'],
        keyShownAs: 'value',
        keyMeasured: true,
        measuredBy: 'GUNW',
        overlay: 'map',
        text: 'mexicoGround',
      },
    ],
  },
  'world-hayli-gubbi': {
    summary: 'hayliGubbi',
    attribution: ['volcano'],
    chapters: [
      {
        key: ['darkened_area', 'km2'],
        keyShownAs: 'value',
        keyMeasured: false,
        measuredBy: 'GCOV',
        overlay: 'map',
        text: 'hayliStain',
      },
      {
        key: ['sinking', 'cm'],
        keyShownAs: 'value',
        keyMeasured: false,
        measuredBy: 'GUNW',
        overlay: 'map',
        text: 'ertaAleSinking',
      },
    ],
  },
  'world-venezuela-quake': {
    summary: 'venezuela',
    attribution: ['quake'],
    chapters: [
      {
        key: ['coast_west', 'cm'],
        keyShownAs: 'range',
        keyMeasured: false,
        measuredBy: 'GUNW',
        overlay: 'map',
        text: 'coastWest',
      },
    ],
  },
  'world-mozambique-flood': {
    summary: 'mozambique',
    attribution: ['flood'],
    chapters: [
      {
        key: ['new_water', 'km2'],
        keyShownAs: 'value',
        keyMeasured: false,
        measuredBy: 'GCOV',
        overlay: 'mask',
        text: 'chokweFlood',
      },
    ],
  },
}

const TOLD_KIND: Readonly<Partial<Record<string, ToldKind>>> = {
  ground: 'ground',
  volcano: 'volcano',
  quake: 'quake',
  flood: 'flood',
}

const UNITS: Readonly<Partial<Record<string, string>>> = {
  cm: EN.units.cm,
  mm: EN.units.mm,
  km2: EN.units.km2,
  dB: EN.units.db,
}
const COUNTS: Readonly<Partial<Record<string, (n: number) => string>>> = EN.told.counts
const CAVEATS: Readonly<Partial<Record<string, string | ((t: ToldValues) => string)>>> =
  EN.told.caveats

const UNIT_SQUARE: readonly LonLat[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

export const toldKind = (kind: string): ToldKind => TOLD_KIND[kind] ?? 'other'

export const isTold = <T extends StoryItem>(item: T): item is Extract<T, { readonly told: Told }> =>
  'told' in item

const byTime = (a: StoryItem, b: StoryItem) => Date.parse(a.time) - Date.parse(b.time)

type Numbers = StoryChapterRecord['numbers']

interface Reader {
  readonly values: ToldValues
  readonly ok: () => boolean
}

function stepOf(number: StoryNumber): number {
  if (COUNTS[number.unit] !== undefined) return 1
  if (number.range !== null) {
    const [low, high] = number.range
    return ROUNDING_STEPS.find((step) => step <= (high - low) / RANGE_STEPS) ?? FINEST_STEP
  }
  const magnitude = Math.abs(number.value)
  if (magnitude === 0) return FINEST_STEP
  const step = 10 ** (Math.floor(Math.log10(magnitude)) - (SIGNIFICANT_DIGITS - 1))
  return Math.max(FINEST_STEP, step)
}

const roundedText = (value: number, step: number) =>
  formatUpTo(Math.round(value / step) * step, step < 1 ? 1 : 0)

const numberText = (number: StoryNumber) => roundedText(number.value, stepOf(number))

function unitText(unit: string, value: number): string {
  const count = COUNTS[unit]
  return count === undefined ? (UNITS[unit] ?? unit) : count(value)
}

function reader(numbers: Numbers, record: StoryChapterRecord, timeZone: string): Reader {
  let failed = false
  const value = (name: string, unit: string): StoryNumber | null => {
    const found = numbers[name]
    if (found?.unit === unit) return found
    failed = true
    return null
  }
  return {
    values: {
      n: (name, unit) => {
        const found = value(name, unit)
        return found === null ? '' : withUnit(numberText(found), unitText(unit, found.value))
      },
      v: (name, unit) => {
        const found = value(name, unit)
        return found === null ? '' : numberText(found)
      },
      cmUp: (name, unit) => {
        const found = value(name, unit)
        const perCm = PER_CM[unit]
        if (found === null || perCm === undefined) {
          failed = true
          return ''
        }
        return withUnit(formatNumber(Math.ceil(found.value / perCm)), EN.units.cm)
      },
      before: formatShortDate(record.before.date, timeZone),
      after: formatShortDate(record.after.date, timeZone),
      beforeYear: formatDate(record.before.date, timeZone),
      afterYear: formatDate(record.after.date, timeZone),
      from: formatShortDate(record.window.from, timeZone),
      toMonth: formatMonthYear(record.window.to, timeZone),
      repeatDays: NISAR_REPEAT_DAYS,
    },
    ok: () => !failed,
  }
}

const specFor = (spec: PlaceSpec, record: StoryChapterRecord): ChapterSpec | null =>
  spec.chapters.find(({ key: [name, unit] }) => record.numbers[name]?.unit === unit) ?? null

function caveatText(code: string, t: ToldValues): string {
  const label = CAVEATS[code]
  if (label === undefined) return EN.told.caveatOther(code)
  return typeof label === 'string' ? label : label(t)
}

interface KeyText {
  readonly key: string
  readonly range: string | null
}

function keyText(record: StoryChapterRecord, spec: ChapterSpec, t: ToldValues): KeyText {
  const [name, unit] = spec.key
  const number = record.numbers[name]
  if (number?.range == null) return { key: t.n(name, unit), range: null }
  const step = stepOf(number)
  const [low, high] = number.range
  const span = { low: roundedText(low, step), high: roundedText(high, step) }
  const unitWord = unitText(unit, high)
  return spec.keyShownAs === 'range'
    ? { key: EN.told.about(withUnit(EN.told.span(span.low, span.high), unitWord)), range: null }
    : { key: t.n(name, unit), range: withUnit(EN.told.range(span.low, span.high), unitWord) }
}

function chartOf(record: StoryChapterRecord, labels: readonly string[]): ToldChart | null {
  const series = record.chart?.series ?? []
  const [first] = series
  if (first === undefined || labels.length !== series.length) return null
  return {
    unit: unitText(first.unit, 0),
    series: series.map((s, i) => ({
      label: labels[i] ?? '',
      points: s.dates.flatMap((time, j) => {
        const value = s.values[j]
        return value === undefined ? [] : [{ time, value }]
      }),
    })),
  }
}

function overlayCrop(imageCorners: Corners, overlay: Corners, crop: UnitRect): UnitRect {
  const toLonLat = fitAffine(UNIT_SQUARE, imageCorners)
  const points = (
    [
      [crop.x, crop.y],
      [crop.x + crop.w, crop.y],
      [crop.x + crop.w, crop.y + crop.h],
      [crop.x, crop.y + crop.h],
    ] as const
  ).map((p) => applyAffine(toLonLat, p))
  const lons = points.map(([lon]) => lon)
  const lats = points.map(([, lat]) => lat)
  const bbox: BBox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
  return bboxRect(overlay, bbox)
}

function coveredShare(corners: Corners, bbox: BBox): number {
  const box = bboxRect(corners, bbox)
  const w = Math.min(1, box.x + box.w) - Math.max(0, box.x)
  const h = Math.min(1, box.y + box.h) - Math.max(0, box.y)
  return Math.max(0, w) * Math.max(0, h)
}

function nearestFrame(frames: readonly RadarFrame[], time: string): number {
  const t = Date.parse(time)
  const gaps = frames.map((f) => Math.abs(Date.parse(f.time) - t))
  return gaps.indexOf(Math.min(...gaps))
}

const passOf = (p: StoryPass): PassRef => ({
  time: p.date,
  track: p.track,
  direction: p.direction,
  scene: p.scene,
})

function passesOf(record: StoryChapterRecord): PassList {
  const before = passOf(record.before)
  const after = passOf(record.after)
  return before.scene === after.scene ? [after] : [before, after]
}

const productOf = (record: StoryChapterRecord): 'GCOV' | 'GSLC' | null => {
  const { product } = record.after
  return product === 'GCOV' || product === 'GSLC' ? product : null
}

interface Context {
  readonly corners: Corners
  readonly frames: readonly RadarFrame[]
  readonly centre: LonLat
  readonly timeZone: string
  readonly scenes: readonly string[]
  readonly attribution: string | null
  readonly pairs: readonly MeasuredPair[]
}

function groundPairs(ground: Ground | null): readonly MeasuredPair[] {
  const first = ground?.pairs[0]
  const last = ground?.pairs.at(-1)
  if (ground === null || first === undefined || last === undefined) return []
  return [
    {
      role: 'event',
      product: ground.product,
      track: ground.track,
      direction: ground.direction,
      from: first.from,
      to: last.to,
      pairs: ground.pairs.length,
      scenes: ground.pairs.map((p) => p.scene),
      image: ground.map.path,
      pixelM: ground.map.pixel_m,
    },
  ]
}

function tileMap(
  pairs: readonly MeasuredPair[],
  image: string | undefined,
  spec: ChapterSpec,
): TileMap | null {
  const pair = spec.overlay === 'map' ? pairs.find((p) => p.image === image) : undefined
  if (pair === undefined || pair.pixelM === null) return null
  return { product: pair.product, pixelM: pair.pixelM, from: pair.from, to: pair.to }
}

function toldItem(ctx: Context, spec: PlaceSpec, record: StoryChapterRecord): StoryItem | null {
  const chapter = specFor(spec, record)
  const product = productOf(record)
  if (chapter === null || product === null || ctx.frames.length === 0) return null
  const text = EN.told.chapter[chapter.text]
  const business = text.businessBecause
  const read = reader(record.numbers, record, ctx.timeZone)
  const t = read.values
  const bbox = clipToWindow(ctx.corners, record.focus_bbox)
  const [west, south, east, north] = bbox
  const lonLat: LonLat = [(west + east) / 2, (south + north) / 2]
  const share = coveredShare(ctx.corners, bbox)
  const wide = share >= WIDE_SHARE
  const { crop, outline } = cropAround(ctx.corners, bbox)
  const overlay = record.overlay
  const map = tileMap(ctx.pairs, overlay?.image, chapter)
  const tile: RadarTile = {
    variant: 'radar',
    colour: 'grey',
    before: { path: record.before.image, time: record.before.date, from: null },
    after: { path: record.after.image, time: record.after.date, from: null },
    crop,
    outline: wide ? null : outline,
    mask: overlay?.image ?? null,
    ...(overlay === null
      ? {}
      : {
          maskCrop: overlayCrop(ctx.corners, overlay.corners_lonlat, crop),
          maskOpaque: chapter.overlay === 'map',
          legend: text.legend(),
        }),
    ...(map === null ? {} : { map }),
  }
  const told: Told = {
    title: text.title,
    sentence: text.sentence(t),
    because: text.because(t),
    businessBecause: business === null ? text.because(t) : business(t),
    notClaimed: text.notClaimed,
    ...keyText(record, chapter, t),
    caveats: record.caveats.map((code) => caveatText(code, t)),
    chart: chartOf(record, text.series(t)),
    measured: ctx.pairs.filter((p) => p.role === 'event' && p.product === chapter.measuredBy),
    scenes: ctx.scenes,
    attribution: ctx.attribution,
  }
  if (!read.ok()) return null
  const where: Where = wide ? { kind: 'view', share } : whereFrom(ctx.centre, lonLat)
  return {
    id: record.id,
    n: null,
    kind: toldKind(record.kind),
    time: record.date,
    frame: frameAt(ctx.frames, record.date) ?? nearestFrame(ctx.frames, record.date),
    lonLat,
    bbox,
    areaHa: null,
    where,
    confidence: record.confidence,
    flags: {
      early: record.caveats.includes('beta_pass'),
      estimate: record.caveats.includes('estimate') && !chapter.keyMeasured,
    },
    tile,
    insetTile: tile,
    clouds: null,
    source: { product, passes: passesOf(record) },
    told,
  }
}

const nonNull = <T>(value: T | null): value is T => value !== null

export function toldChapters(data: PlaceData): readonly Chapter[] {
  const story = data.story
  const spec = SPECS[data.slug]
  const radar = data.radar
  if (story === null || spec === undefined || radar === null) return []
  const ctx: Context = {
    corners: radar.corners_lonlat,
    frames: radar.frames,
    centre: [data.catalog.place.lon, data.catalog.place.lat],
    timeZone: placeBySlug(data.slug).timeZone,
    scenes: story.generated_from,
    attribution:
      spec.attribution.length === 0
        ? null
        : spec.attribution.map((key) => EN.told.attribution[key]).join(' '),
    pairs: data.eventPairs ?? groundPairs(data.ground),
  }
  return story.chapters
    .map((record) => toldItem(ctx, spec, record))
    .filter(nonNull)
    .sort(byTime)
    .map((item, i): Chapter => ({ ...item, n: i + 1 }))
}

export function withTold(story: Story, data: PlaceData): Story {
  const told = toldChapters(data)
  const [first] = told
  if (first === undefined) return story
  const frames = data.radar?.frames ?? []
  const anchor = frames[first.frame]
  const background =
    anchor === undefined ? story.background : { track: anchor.track, direction: anchor.direction }
  const restFrame =
    frames.length === 0 ? story.restFrame : backgroundFrame(frames, background, frames.length - 1)
  return { ...story, chapters: told, changes: told, secondary: [], background, restFrame }
}

export function toldSummary(data: PlaceData): ToldSummary | null {
  const spec = SPECS[data.slug]
  if (spec === undefined || data.story === null) return null
  const records = data.story.chapters.filter((r) => specFor(spec, r) !== null)
  const [first] = records
  if (first === undefined) return null
  const numbers = records.reduce<Numbers>((all, r) => ({ ...all, ...r.numbers }), {})
  const read = reader(numbers, first, placeBySlug(data.slug).timeZone)
  const text = EN.told.summary[spec.summary]
  const summary = { short: text.short(read.values), long: text.long(read.values) }
  return read.ok() ? summary : null
}

export function toldCount(slug: string, story: PlaceStory): number | null {
  const spec = SPECS[slug]
  if (spec === undefined) return null
  const count = story.chapters.filter((r) => specFor(spec, r) !== null).length
  return count === 0 ? null : count
}

export function playable(data: PlaceData): boolean {
  const frames = data.radar?.frames ?? []
  const first = frames[0]
  const last = frames.at(-1)
  if (first === undefined || last === undefined) return false
  return Date.parse(last.time) - Date.parse(first.time) >= MIN_PLAY_SPAN_DAYS * DAY_MS
}

export function toldWhere(where: Where): string {
  if (where.kind === 'centre') return EN.told.centre
  if (where.kind === 'view') return EN.where.view[viewPart(where.share)]
  return EN.where.away(
    withUnit(formatNumber(where.km), EN.units.km),
    EN.where.compass[where.toward],
  )
}

export const toldTrust = (item: ToldItem): string =>
  item.flags.estimate
    ? `${EN.confidence[item.confidence]}, ${EN.told.estimate}`
    : EN.confidence[item.confidence]

export const toldFacts = (item: ToldItem, timeZone: string): string =>
  [item.told.key, formatDate(item.time, timeZone), toldTrust(item)].join(', ')

export function toldCardFacts(item: ToldItem, timeZone: string): string {
  const { key, range } = item.told
  return [
    range === null ? key : EN.told.keyRange(key, range),
    formatDate(item.time, timeZone),
    EN.confidence[item.confidence],
  ].join(', ')
}

export function nextTold(story: Story, current: string | null): ToldItem | null {
  const told = story.chapters.filter(isTold)
  const at = told.findIndex((c) => c.id === current)
  return told[(at + 1) % Math.max(1, told.length)] ?? null
}
