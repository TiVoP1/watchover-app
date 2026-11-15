import type { BusinessRow, Population } from '#web/business/motion.ts'
import type { MotionObject, NullLabel } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import type { Heat, HeatOrbit, HeatRange } from '#web/story/chapters.ts'
import { areaText, buildingHeadline, whereText } from '#web/story/story-text.ts'
import { type LonLat, whereFrom } from '#web/story/where.ts'
import { formatNumber, formatSigned } from '#web/ui/format.ts'

const M2_PER_HA = 10_000
const SLOPE_DIGITS = 2
const ALMOST_EVERY_SHARE = 0.9
const SEASON_CYCLE_MONTHS = 12

const STATUS: Readonly<Record<NullLabel, string>> = {
  beats_all: EN.business.status.clear,
  borderline: EN.business.status.borderline,
  like_open_ground: EN.business.status.noise,
}

const BUILDING_TYPES: ReadonlyMap<string, string> = new Map(
  Object.entries(EN.business.buildingType),
)

export const statusText = (label: NullLabel): string => STATUS[label]

export function nounOf(object: MotionObject): string {
  if (object.kind !== 'building') return EN.change.heat.title[object.kind]
  return BUILDING_TYPES.get(object.building ?? '') ?? EN.change.heat.title.building
}

export const objectLabel = (object: MotionObject, centre: LonLat): string =>
  EN.business.label(
    nounOf(object),
    areaText(object.area_m2 / M2_PER_HA),
    whereText(whereFrom(centre, [object.lon, object.lat])),
  )

export const slopeText = (orbit: HeatOrbit, errorScale: number): string | null =>
  orbit.mmPerC === null || orbit.mmPerCErr === null
    ? null
    : EN.business.slope(
        formatSigned(orbit.mmPerC, SLOPE_DIGITS),
        formatNumber(orbit.mmPerCErr * errorScale, SLOPE_DIGITS),
      )

export function rowHeadline(
  object: MotionObject,
  label: NullLabel | null,
  range: HeatRange | null,
): string | null {
  const clear = label === 'beats_all' && range !== null && range.mmPerC > 0
  return clear ? buildingHeadline(object.kind, range) : null
}

export function watchSentence(heat: Heat, errorScale: number): string | null {
  const slope = heat.evening === null ? null : slopeText(heat.evening, errorScale)
  return slope === null ? null : EN.business.watch(slope)
}

export const populationLine = (population: Population): string =>
  EN.business.population(population.towards, population.total)

function aloneText({ noise, total }: Population): string | null {
  if (noise === null) return null
  if (noise === total) return EN.business.alone.all
  return noise >= total * ALMOST_EVERY_SHARE
    ? EN.business.alone.most
    : EN.business.alone.some(noise, total)
}

export function colourKey(rows: readonly BusinessRow[]): string | null {
  const slopes = rows
    .filter((r) => r.label === 'beats_all' && r.object.kind === 'building')
    .flatMap((r) => r.heat.evening?.mmPerC ?? [])
  const towards = slopes.some((k) => k > 0)
  const away = slopes.some((k) => k < 0)
  if (towards && away) return EN.business.keyColour.both
  if (towards) return EN.business.keyColour.towards
  return away ? EN.business.keyColour.away : null
}

export function populationMeta(population: Population, months: number | null): string | null {
  const season = months !== null && months < SEASON_CYCLE_MONTHS ? EN.business.season : null
  const parts = [aloneText(population), season].filter((part) => part !== null)
  return parts.length === 0 ? null : parts.join(' ')
}
