import { orbitPart } from '#web/data/nisar.ts'
import type { Confidence, Direction, MotionObject } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import type { DataGap, Heat, HeatRange, Story, StoryItem } from '#web/story/chapters.ts'
import type { ChangeKind } from '#web/story/kinds.ts'
import { isTold, type ToldItem } from '#web/story/place-story.ts'
import { viewPart, type Where } from '#web/story/where.ts'
import {
  addDays,
  formatDate,
  formatDateSpan,
  formatMonth,
  formatMonthYear,
  formatNumber,
  formatShortDate,
  formatSigned,
  formatUpTo,
  formatUtcDate,
  formatUtcTime,
  withUnit,
} from '#web/ui/format.ts'

const AREA_DIGITS = 1
const SMALL_AREA_DIGITS = 2
const DB_DIGITS = 1
const COHERENCE_DIGITS = 2
const SLOPE_DIGITS = 2
const MM_DIGITS = 1
const TEMPERATURE_DIGITS = 1
const PERCENT = 100
const UTC = 'UTC'

const RECAP_ORDER: readonly ChangeKind[] = ['forest', 'fields', 'water', 'rework', 'frost']

export interface SourceLine {
  readonly pass: string
  readonly scene: string
}

export interface RecapLine {
  readonly kind: ChangeKind
  readonly text: string
}

export const confidenceWord = (confidence: Confidence): string => EN.confidence[confidence]

export const directionWord = (direction: Direction): string =>
  direction === 'ASCENDING' ? EN.ascending : EN.descending

export const areaText = (ha: number): string =>
  withUnit(formatUpTo(ha, ha < 1 ? SMALL_AREA_DIGITS : AREA_DIGITS), EN.units.ha)

const celsius = (t: number, digits: number): string =>
  withUnit(formatNumber(t, digits), EN.units.celsius)

export const temperatureText = (t: number): string => celsius(t, TEMPERATURE_DIGITS)

export const mmText = (mm: number, digits = MM_DIGITS): string =>
  withUnit(formatNumber(mm, digits), EN.units.mm)

export function buildingHeadline(kind: MotionObject['kind'], range: HeatRange): string {
  const noun = EN.change.heat.noun[kind]
  const hi = mmText(range.hiMm, 0)
  return range.loMm === range.hiMm
    ? EN.change.heat.headlineAbout(noun, hi)
    : EN.change.heat.headline(noun, formatNumber(range.loMm), hi)
}

export function buildingBecause(range: HeatRange): string {
  const hi = mmText(range.hiMm, 0)
  const moved =
    range.loMm === range.hiMm
      ? EN.change.heat.about(hi)
      : EN.change.heat.range(formatNumber(range.loMm), hi)
  return EN.change.heat.because(celsius(range.rangeC, 0), moved)
}

export function heatMeta(heat: Heat, errorScale: number, withSlope = true): string | null {
  const evening = heat.evening
  if (evening === null) return null
  const { mmPerC, mmPerCErr } = evening
  if (mmPerC === null || mmPerCErr === null) return null
  const fitted = evening.passes.filter(
    (p) => p.losMmFromColdest !== null && p.tempC !== null,
  ).length
  const slope = EN.change.heat.metaEvening(
    formatSigned(mmPerC, SLOPE_DIGITS),
    formatNumber(mmPerCErr * errorScale, SLOPE_DIGITS),
    fitted,
  )
  return [
    ...(withSlope ? [slope] : []),
    ...(heat.dawn?.warmPasses === 1 ? [EN.change.heat.metaDawn] : []),
    EN.change.heat.metaLine,
    EN.change.heat.metaAir,
  ].join(' ')
}

const localYear = (iso: string, timeZone: string): string =>
  Number.isNaN(Date.parse(iso)) ? '' : formatDate(iso, timeZone).slice(-4)

export const dateText = (iso: string, timeZone: string, latestPass: string): string =>
  localYear(latestPass, timeZone) === '' ||
  localYear(iso, timeZone) === localYear(latestPass, timeZone)
    ? formatShortDate(iso, timeZone)
    : formatDate(iso, timeZone)

export function spanText(
  from: string,
  to: string,
  timeZone: string,
): { readonly from: string; readonly to: string } {
  return { from: dateText(from, timeZone, to), to: formatDate(to, timeZone) }
}

export const missingDays = (gap: DataGap): { readonly from: string; readonly to: string } => ({
  from: addDays(gap.from, 1),
  to: addDays(gap.to, -1),
})

export function monthSpanText(
  from: string,
  to: string,
  timeZone: string,
): { readonly from: string; readonly to: string } {
  const sameYear = localYear(from, timeZone) === localYear(to, timeZone)
  return {
    from: sameYear ? formatMonth(new Date(from), timeZone) : formatMonthYear(from, timeZone),
    to: formatMonthYear(to, timeZone),
  }
}

export function whereText(where: Where): string {
  if (where.kind === 'centre') return EN.where.centre
  if (where.kind === 'view') return EN.where.view[viewPart(where.share)]
  return EN.where.away(
    withUnit(formatNumber(where.km), EN.units.km),
    EN.where.compass[where.toward],
  )
}

const whereShortText = (where: Where): string =>
  where.kind === 'away'
    ? EN.where.awayShort(
        withUnit(formatNumber(where.km), EN.units.km),
        EN.where.compassShort[where.toward],
      )
    : whereText(where)

const sizeText = (item: StoryItem): string =>
  item.areaHa === null ? whereText(item.where) : areaText(item.areaHa)

const drawnDirection = (item: StoryItem): Direction | null =>
  item.source.passes.at(-1)?.direction ?? null

export function itemTitle(item: StoryItem): string {
  if (isTold(item)) return item.told.title
  if (item.kind === 'heat') {
    const object = item.heat.object
    return object.name ?? EN.change.heat.title[object.kind]
  }
  return EN.change[item.kind].title
}

export function cardTitle(item: StoryItem, timeZone: string): string {
  if (item.kind !== 'frost') return itemTitle(item)
  const direction = drawnDirection(item)
  const dawn = direction === null || orbitPart(direction) === 'dawn'
  const when = dawn ? EN.change.frost.beforeDawn : EN.change.frost.afterDusk
  return EN.change.frost.cardTitle(formatDate(item.time, timeZone), when)
}

export function itemSentence(item: StoryItem): string {
  if (isTold(item)) return item.told.sentence
  switch (item.kind) {
    case 'frost':
      return EN.change.frost.sentence
    case 'forest':
      return item.insetTile.variant === 'clouds'
        ? EN.change.forest.sentenceClouds(sizeText(item))
        : EN.change.forest.sentence(sizeText(item))
    case 'fields':
      return EN.change.fields.sentence(sizeText(item))
    case 'water':
      return EN.change.water.sentence(sizeText(item))
    case 'rework':
      return EN.change.rework.sentence(sizeText(item))
    case 'heat':
      return buildingHeadline(item.heat.object.kind, item.range)
  }
}

export function lookSentence(item: StoryItem, timeZone: string, latestPass: string): string {
  if (isTold(item)) return item.told.sentence
  switch (item.kind) {
    case 'forest':
      return EN.change.forest.look(sizeText(item))
    case 'rework':
      return EN.change.rework.look(sizeText(item))
    case 'water':
      return EN.change.water.look(sizeText(item))
    case 'fields': {
      const [first] = item.source.passes
      const last = item.source.passes.at(-1) ?? first
      return EN.change.fields.cardSentence(
        sizeText(item),
        dateText(first.time, timeZone, latestPass),
        dateText(last.time, timeZone, latestPass),
      )
    }
    case 'frost':
    case 'heat':
      return itemSentence(item)
  }
}

export function becauseText(item: StoryItem, timeZone: string): string {
  if (isTold(item)) return item.told.because
  switch (item.kind) {
    case 'forest':
      return EN.change.forest.because(item.event.passes)
    case 'frost': {
      const frozen = EN.change.frost.because(whereText(item.where))
      const air = item.tempC === null ? null : EN.change.frost.air(celsius(item.tempC, 0))
      return [frozen, air, EN.change.frost.notCut].filter((s) => s !== null).join(' ')
    }
    case 'fields': {
      const to = formatShortDate(item.time, timeZone)
      const seen = item.event.passes > 1 ? EN.change.fields.confirmed : EN.change.fields.once
      return `${EN.change.fields.because(to)} ${seen}`
    }
    case 'water':
      return EN.change.water.because
    case 'rework':
      return EN.change.rework.because(
        formatShortDate(item.activity.from, timeZone),
        formatShortDate(item.activity.to, timeZone),
      )
    case 'heat':
      return buildingBecause(item.range)
  }
}

export const metaText = (item: StoryItem, errorScale: number): string | null =>
  item.kind === 'heat' ? heatMeta(item.heat, errorScale) : null

export const notClaimedText = (item: StoryItem): string =>
  isTold(item) ? item.told.notClaimed : EN.change[item.kind].notClaimed

export function factsText(item: StoryItem, timeZone: string, latestPass: string): string {
  const parts = [
    item.areaHa === null ? null : areaText(item.areaHa),
    whereShortText(item.where),
    dateText(item.time, timeZone, latestPass),
    confidenceWord(item.confidence),
  ]
  return parts.filter((p) => p !== null).join(', ')
}

export function cardFactsText(item: StoryItem, timeZone: string, latestPass: string): string {
  const dated = item.kind !== 'frost' && item.kind !== 'heat'
  const parts = [
    item.areaHa === null ? null : areaText(item.areaHa),
    dated ? dateText(item.time, timeZone, latestPass) : null,
    confidenceWord(item.confidence),
  ]
  return parts.filter((p) => p !== null).join(', ')
}

export function pinText(item: StoryItem): string {
  const parts = [item.areaHa === null ? null : areaText(item.areaHa), whereText(item.where)]
  return EN.map.pinLabel(itemTitle(item), parts.filter((p) => p !== null).join(', '))
}

export function sourceLines(item: StoryItem): readonly SourceLine[] {
  return item.source.passes.map((p) => ({
    pass: EN.card.sourceLine(
      item.source.product,
      formatUtcDate(p.time),
      formatUtcTime(p.time),
      p.track,
      directionWord(p.direction),
    ),
    scene: EN.card.scene(p.scene),
  }))
}

export const measuredLines = (item: ToldItem): readonly string[] =>
  item.told.measured.map((pair) =>
    EN.told.measured(
      pair.product,
      pair.pairs,
      pair.track,
      directionWord(pair.direction),
      ...formatDateSpan(pair.from, pair.to, UTC),
      formatUtcTime(pair.from),
    ),
  )

const decibels = (value: number): string => withUnit(formatNumber(value, DB_DIGITS), EN.units.db)

export function sourceTermText(item: StoryItem, errorScale: number): string | null {
  if (isTold(item)) return null
  if (item.kind === 'rework') {
    return EN.card.coherence(
      formatNumber(item.activity.typical_coherence, COHERENCE_DIGITS),
      formatNumber(item.activity.pair_coherence, COHERENCE_DIGITS),
    )
  }
  if (item.kind === 'heat') {
    return errorScale === 1 ? null : EN.business.errorsWidened(formatNumber(errorScale, 1))
  }
  const { event } = item
  return EN.card.backscatter(
    event.metric,
    withUnit(formatSigned(event.magnitude_db, DB_DIGITS), EN.units.db),
    decibels(event.before_db),
    decibels(event.after_db),
  )
}

export function recapLines(story: Story): readonly RecapLine[] {
  return RECAP_ORDER.flatMap((kind): RecapLine[] => {
    const items = story.changes.filter((c) => c.kind === kind)
    const [first] = items
    const n = items.length
    if (first === undefined) return []
    if (kind === 'frost') {
      const direction = drawnDirection(first)
      const evening = direction !== null && orbitPart(direction) === 'evening'
      return [{ kind, text: evening ? EN.recap.frostEvening(n) : EN.recap.frostMorning(n) }]
    }
    if (kind === 'forest') return [{ kind, text: EN.recap.forest(n) }]
    if (kind === 'fields') return [{ kind, text: EN.recap.fields(n) }]
    if (kind === 'water') return [{ kind, text: EN.recap.water(n) }]
    return [{ kind, text: EN.recap.rework(n) }]
  })
}

export const cloudPercent = (share: number): number => Math.round(share * PERCENT)
