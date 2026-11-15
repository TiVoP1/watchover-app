import { EVENING_ORBIT } from '#web/data/nisar.ts'
import type {
  MotionObject,
  NullCheck,
  NullLabel,
  Objects,
  PlaceData,
  TrackNumberKey,
  TrackSeries,
} from '#web/data/types.ts'
import type { StoreState } from '#web/state/store.ts'
import { type Heat, heatOf, heatRange, type HeatRange, type Story } from '#web/story/chapters.ts'

export type Pin = 'story' | 'watch'

export interface BusinessRow {
  readonly object: MotionObject
  readonly label: NullLabel | null
  readonly pin: Pin | null
  readonly heat: Heat
  readonly range: HeatRange | null
}

export interface Population {
  readonly towards: number
  readonly total: number
  readonly noise: number | null
}

export interface EarlyResult {
  readonly passes: number
  readonly months: number
}

const DAY_MS = 86_400_000
const DAYS_PER_MONTH = 365.25 / 12
const UNPINNED = 2
const UNCHECKED = 3

const PIN_RANK: Readonly<Record<Pin, number>> = { story: 0, watch: 1 }

const LABEL_RANK: Readonly<Record<NullLabel, number>> = {
  beats_all: 0,
  borderline: 1,
  like_open_ground: 2,
}

export function eveningSeries(
  objects: Objects,
): readonly [key: string, series: TrackSeries] | null {
  return Object.entries(objects.tracks).find(([, t]) => t.direction === EVENING_ORBIT) ?? null
}

export const labelsOf = (nullCheck: NullCheck | null): ReadonlyMap<string, NullLabel> =>
  new Map((nullCheck?.objects ?? []).map((o) => [o.osm, o.label]))

const trackKey = (track: number): TrackNumberKey => `${track}`

export function watchCandidate(objects: Objects, nullCheck: NullCheck | null): string | null {
  const evening = eveningSeries(objects)
  if (nullCheck === null || evening === null) return null
  const track = trackKey(evening[1].track)
  const limit = nullCheck.z_p95[track]
  if (limit === undefined) return null
  const buildings = new Set(objects.objects.filter((o) => o.kind === 'building').map((o) => o.osm))
  let best: { readonly osm: string; readonly z: number } | null = null
  for (const checked of nullCheck.objects) {
    const z = checked.z[track] ?? null
    if (z === null || checked.label !== 'like_open_ground' || !buildings.has(checked.osm)) continue
    if (z <= -limit && (best === null || z < best.z)) best = { osm: checked.osm, z }
  }
  return best?.osm ?? null
}

export function eveningPopulation(
  objects: Objects,
  nullCheck: NullCheck | null,
): Population | null {
  const key = eveningSeries(objects)?.[0]
  if (key === undefined) return null
  const labels = nullCheck === null ? null : labelsOf(nullCheck)
  const sloped = objects.objects.flatMap((o) => {
    const k = o.kind === 'building' ? (o.tracks[key]?.mm_per_c ?? null) : null
    return k === null ? [] : [{ k, label: labels?.get(o.osm) ?? null }]
  })
  if (sloped.length === 0) return null
  const count = (keep: (s: (typeof sloped)[number]) => boolean) => sloped.filter(keep).length
  return {
    towards: count((s) => s.k > 0),
    total: sloped.length,
    noise: labels === null ? null : count((s) => s.label === 'like_open_ground'),
  }
}

export function earlyResult(data: PlaceData): EarlyResult | null {
  const series = data.objects === null ? null : eveningSeries(data.objects)
  const first = series?.[1].passes[0]
  const last = series?.[1].passes.at(-1)
  if (series === null || first === undefined || last === undefined) return null
  const days = (Date.parse(last) - Date.parse(first)) / DAY_MS
  return {
    passes: data.nullCheck?.passes_per_track ?? series[1].passes.length,
    months: Math.max(1, Math.round(days / DAYS_PER_MONTH)),
  }
}

export const storyObject = (story: Story | null): string | null =>
  story?.chapters.flatMap((c) => (c.kind === 'heat' ? [c.heat.object.osm] : []))[0] ?? null

const pinRank = (row: BusinessRow): number => (row.pin === null ? UNPINNED : PIN_RANK[row.pin])

const labelRank = (row: BusinessRow): number =>
  row.label === null ? UNCHECKED : LABEL_RANK[row.label]

const byRow = (a: BusinessRow, b: BusinessRow): number =>
  pinRank(a) - pinRank(b) ||
  labelRank(a) - labelRank(b) ||
  Number(a.object.name === null) - Number(b.object.name === null) ||
  b.object.area_m2 - a.object.area_m2 ||
  a.object.osm.localeCompare(b.object.osm)

export function businessRows(data: PlaceData, story: Story | null): BusinessRow[] {
  const objects = data.objects
  if (objects === null) return []
  const labels = labelsOf(data.nullCheck)
  const errorScale = data.nullCheck?.error_inflation ?? 1
  const pinned = new Map<string, Pin>()
  const watch = watchCandidate(objects, data.nullCheck)
  if (watch !== null) pinned.set(watch, 'watch')
  const told = storyObject(story)
  if (told !== null) pinned.set(told, 'story')
  return objects.objects
    .map((object): BusinessRow => {
      const heat = heatOf(objects, object)
      return {
        object,
        label: labels.get(object.osm) ?? null,
        pin: pinned.get(object.osm) ?? null,
        heat,
        range: heat.evening === null ? null : heatRange(heat.evening, errorScale),
      }
    })
    .sort(byRow)
}

export const selectWatchObject = (s: StoreState): string | null =>
  s.place.status === 'ready' && s.place.data.objects !== null
    ? watchCandidate(s.place.data.objects, s.place.data.nullCheck)
    : null

export const selectErrorScale = (s: StoreState): number =>
  s.place.status === 'ready' ? (s.place.data.nullCheck?.error_inflation ?? 1) : 1
