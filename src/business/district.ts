import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'
import { eveningSeries, labelsOf, watchCandidate } from '#web/business/motion.ts'
import { losColour } from '#web/business/tint.ts'
import { EVENING_ORBIT } from '#web/data/nisar.ts'
import type {
  Direction,
  NullCheck,
  NullLabel,
  ObjectFootprints,
  Objects,
  TrackSeries,
} from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { COLOR } from '#web/tokens.ts'
import { formatDate, formatNumber, formatUtcDate, formatUtcTime } from '#web/ui/format.ts'

export const WARM_PASS: Direction = EVENING_ORBIT
export const NEUTRAL_HEIGHT_M = 40
export const MIN_HEIGHT_M = 4
export const HEIGHT_EXAGGERATION = 20_000
export const HEIGHT_M_PER_MM = HEIGHT_EXAGGERATION / 1000
export const HEIGHT_CAP_MM = 6
export const COLOUR_SCALE_MM_PER_C = 0.3
const HEIGHT_FLOOR_MM = -(NEUTRAL_HEIGHT_M - MIN_HEIGHT_M) / HEIGHT_M_PER_MM
const DISTRICT_HALF_WIDTH_M = 2000
const DISTRICT_HALF_HEIGHT_M = 1000
const DISTRICT_MARGIN_M = 500
const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LON_AT_EQUATOR = 111_320

export interface DistrictProps {
  readonly osm: string
  readonly clear: boolean
  readonly watch: boolean
  readonly eveningMmPerC: number | null
  readonly colour: string
}

export type District = FeatureCollection<Polygon, DistrictProps>

export interface LosPass {
  readonly key: string
  readonly index: number
  readonly time: string
  readonly track: number
}

export interface HeightsState {
  readonly kind: 'before' | 'during' | 'after'
  readonly pass: LosPass
  readonly coldest: string
}

const warmTracks = (objects: Objects): [string, TrackSeries][] =>
  Object.entries(objects.tracks).filter(([, t]) => t.direction === WARM_PASS)

export function districtTint(eveningMmPerC: number | null, label: NullLabel | null): string {
  if (label !== 'beats_all') return COLOR.control
  return losColour((eveningMmPerC ?? 0) / COLOUR_SCALE_MM_PER_C)
}

export function districtGeojson(
  footprints: ObjectFootprints,
  objects: Objects,
  nullCheck: NullCheck | null,
): District {
  const byOsm = new Map(objects.objects.map((o) => [o.osm, o]))
  const labels = labelsOf(nullCheck)
  const watch = watchCandidate(objects, nullCheck)
  const evening = eveningSeries(objects)?.[0]
  const features = footprints.features.flatMap((f): Feature<Polygon, DistrictProps>[] => {
    const geometry = f.geometry
    const o = byOsm.get(f.properties.osm)
    if (geometry.type !== 'Polygon' || o?.kind !== 'building') return []
    const eveningMmPerC = evening === undefined ? null : (o.tracks[evening]?.mm_per_c ?? null)
    const label = labels.get(o.osm) ?? null
    const properties = {
      osm: o.osm,
      clear: label === 'beats_all',
      watch: o.osm === watch,
      eveningMmPerC,
      colour: districtTint(eveningMmPerC, label),
    }
    return [{ type: 'Feature', geometry, properties }]
  })
  return { type: 'FeatureCollection', features }
}

export function districtColour(selected: string | null): ExpressionSpecification {
  return [
    'case',
    ['==', ['get', 'clear'], true],
    ['get', 'colour'],
    ['==', ['get', 'osm'], selected ?? ''],
    COLOR.text,
    ['==', ['get', 'watch'], true],
    COLOR.text2,
    COLOR.control,
  ]
}

const losPasses = (objects: Objects): LosPass[] =>
  warmTracks(objects)
    .flatMap(([key, t]) => t.passes.map((time, index) => ({ key, index, time, track: t.track })))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))

export function heightsState(objects: Objects, frameTime: string): HeightsState | null {
  const passes = losPasses(objects)
  const first = passes[0]
  const last = passes.at(-1)
  if (first === undefined || last === undefined) return null
  const t = Date.parse(frameTime)
  const latest = passes.filter((p) => Date.parse(p.time) <= t).at(-1)
  const pass = latest ?? first
  const series = objects.tracks[pass.key]
  const coldest = series?.passes[series.cold_pass]
  if (coldest === undefined) return null
  if (latest === undefined) return { kind: 'before', pass, coldest }
  const kind = latest === last && t > Date.parse(last.time) ? 'after' : 'during'
  return { kind, pass, coldest }
}

export const exaggerationNote = (): string =>
  EN.business.exaggeration(formatNumber(HEIGHT_EXAGGERATION))

export const heightsLine = (state: HeightsState, timeZone: string): string =>
  state.kind === 'before'
    ? EN.business.heightsBefore(formatDate(state.pass.time, timeZone))
    : exaggerationNote()

export function heightsSource(objects: Objects, frameTime: string): string | null {
  const state = heightsState(objects, frameTime)
  const series = state === null ? undefined : objects.tracks[state.pass.key]
  if (state === null || state.kind === 'before' || series === undefined) return null
  return EN.business.heightsPlate(
    series.track,
    series.direction === 'ASCENDING' ? EN.map.plate.ascending : EN.map.plate.descending,
    formatUtcDate(state.pass.time),
    formatUtcTime(state.pass.time),
  )
}

const clampMm = (mm: number): number => Math.min(HEIGHT_CAP_MM, Math.max(HEIGHT_FLOOR_MM, mm))

function warmthC(objects: Objects, state: HeightsState): number {
  const series = objects.tracks[state.pass.key]
  const now = series?.temperature_c[state.pass.index] ?? null
  const coldest = series === undefined ? null : (series.temperature_c[series.cold_pass] ?? null)
  return state.kind === 'before' || now === null || coldest === null ? 0 : now - coldest
}

export function districtHeights(
  district: District,
  objects: Objects,
  state: HeightsState,
): Map<string, number> {
  const warmth = warmthC(objects, state)
  return new Map(
    district.features.map(({ properties: p }) => [
      p.osm,
      p.clear ? clampMm((p.eveningMmPerC ?? 0) * warmth) : 0,
    ]),
  )
}

export function districtBounds(
  district: District,
  objects: Objects,
): [[number, number], [number, number]] | null {
  const focus = new Set(
    district.features
      .filter((f) => f.properties.clear || f.properties.watch)
      .map((f) => f.properties.osm),
  )
  const points = objects.objects.filter((o) => focus.has(o.osm))
  if (points.length === 0) return null
  const lons = points.map((o) => o.lon)
  const lats = points.map((o) => o.lat)
  const [west, east] = [Math.min(...lons), Math.max(...lons)]
  const [south, north] = [Math.min(...lats), Math.max(...lats)]
  const lon = (west + east) / 2
  const lat = (south + north) / 2
  const mPerDegLon = M_PER_DEG_LON_AT_EQUATOR * Math.cos((lat * Math.PI) / 180)
  const halfWidthM = Math.max(
    DISTRICT_HALF_WIDTH_M,
    ((east - west) * mPerDegLon) / 2 + DISTRICT_MARGIN_M,
  )
  const halfHeightM = Math.max(
    DISTRICT_HALF_HEIGHT_M,
    ((north - south) * M_PER_DEG_LAT) / 2 + DISTRICT_MARGIN_M,
  )
  const dLon = halfWidthM / mPerDegLon
  const dLat = halfHeightM / M_PER_DEG_LAT
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat + dLat],
  ]
}
