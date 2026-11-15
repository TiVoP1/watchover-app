import { EVENING_ORBIT, NISAR_REPEAT_DAYS, orbitPart, type OrbitPart } from '#web/data/nisar.ts'
import type {
  ActivityEvent,
  ActivityPair,
  BBox,
  ChangeEvent,
  CloudDay,
  Confidence,
  Corners,
  Direction,
  EventType,
  InsarMeta,
  MotionObject,
  NullLabel,
  ObjectTrack,
  Objects,
  PassRef,
  PlaceData,
  RadarFrame,
  RadarMeta,
} from '#web/data/types.ts'
import {
  bboxRect,
  type CropOptions,
  cropAround,
  groundSizeM,
  squareBBox,
  type UnitRect,
} from '#web/story/crop.ts'
import type { ChangeKind, ToldKind } from '#web/story/kinds.ts'
import type { Told } from '#web/story/place-story.ts'
import { type LonLat, type Where, whereFrom } from '#web/story/where.ts'

export interface TileImage {
  readonly path: string
  readonly time: string
  readonly from: string | null
}

export interface TileMap {
  readonly product: string
  readonly pixelM: number
  readonly from: string
  readonly to: string
}

export interface RadarTile {
  readonly variant: 'radar'
  readonly colour: 'grey' | 'false'
  readonly before: TileImage
  readonly after: TileImage
  readonly crop: UnitRect
  readonly outline: UnitRect | null
  readonly mask: string | null
  readonly maskCrop?: UnitRect
  readonly maskOpaque?: boolean
  readonly map?: TileMap
  readonly legend?: string
}

export interface CoherenceTile {
  readonly variant: 'coherence'
  readonly before: TileImage
  readonly after: TileImage
  readonly crop: UnitRect
  readonly outline: UnitRect
}

export interface CloudTile {
  readonly variant: 'clouds'
  /** Daily optical mosaic; its time is noon UTC of that day, so show the date only. */
  readonly optical: TileImage
  readonly opticalCrop: UnitRect
  readonly opticalOutline: UnitRect
  readonly radar: TileImage
  readonly radarCrop: UnitRect
  readonly outline: UnitRect
  readonly cloudShare: number
}

export interface ChartTile {
  readonly variant: 'chart'
  readonly heat: Heat
}

export type Tile = RadarTile | CoherenceTile | CloudTile | ChartTile

export interface HeatPass {
  readonly time: string
  readonly scene: string
  readonly tempC: number | null
  readonly losMmFromColdest: number | null
}

export interface HeatOrbit {
  readonly key: string
  readonly track: number
  readonly direction: Direction
  readonly part: OrbitPart
  readonly passes: readonly HeatPass[]
  readonly hot: number
  readonly cold: number
  readonly warmPasses: number
  readonly hotColdMm: number | null
  readonly hotColdErrMm: number | null
  readonly mmPerC: number | null
  readonly mmPerCErr: number | null
}

export interface Heat {
  readonly object: MotionObject
  readonly evening: HeatOrbit | null
  readonly dawn: HeatOrbit | null
}

export interface HeatRange {
  readonly loMm: number
  readonly hiMm: number
  readonly mmPerC: number
  readonly mmPerCErr: number
  readonly rangeC: number
  readonly passes: number
}

export interface ItemFlags {
  readonly early: boolean
  readonly estimate: boolean
}

export type PassList = readonly [PassRef, ...PassRef[]]

export interface SourceRef {
  readonly product: 'GCOV' | 'GSLC'
  readonly passes: PassList
}

interface ItemBase {
  readonly id: string
  readonly n: number | null
  readonly time: string
  readonly frame: number
  readonly lonLat: LonLat
  readonly bbox: BBox
  readonly areaHa: number | null
  readonly where: Where
  readonly confidence: Confidence
  readonly flags: ItemFlags
  readonly tile: Tile
  readonly insetTile: Tile
  readonly clouds: CloudTile | null
  readonly source: SourceRef
}

export type StoryItem =
  | (ItemBase & {
      readonly kind: 'frost'
      readonly event: ChangeEvent
      readonly tempC: number | null
    })
  | (ItemBase & { readonly kind: 'forest' | 'fields' | 'water'; readonly event: ChangeEvent })
  | (ItemBase & {
      readonly kind: 'rework'
      readonly activity: ActivityEvent
      readonly pair: ActivityPair
    })
  | (ItemBase & {
      readonly kind: 'heat'
      readonly heat: Heat
      readonly range: HeatRange
    })
  | (ItemBase & { readonly kind: ToldKind; readonly told: Told })

export type Chapter = StoryItem & { readonly n: number }

export interface DataGap {
  readonly from: string
  readonly to: string
  readonly lastBefore: number
  readonly firstAfter: number
}

export interface WeatherSetAside {
  readonly setAside: number
  readonly total: number
  readonly from: string
  readonly to: string
}

export interface TrackRef {
  readonly track: number
  readonly direction: Direction
}

export interface Story {
  readonly chapters: readonly Chapter[]
  readonly changes: readonly Chapter[]
  readonly secondary: readonly StoryItem[]
  readonly gap: DataGap | null
  readonly weather: WeatherSetAside | null
  readonly clouds: { readonly cloudyDays: number; readonly passDays: number } | null
  readonly passes: number
  readonly background: TrackRef | null
  readonly restFrame: number
  readonly pixelM: number | null
  readonly viewKm: { readonly width: number; readonly height: number } | null
}

const DAY_MS = 86_400_000
const PASS_MATCH_MS = 3_600_000
const M2_PER_HA = 10_000
const M_PER_KM = 1000
const TENTHS = 10
const FOREST_CHAPTERS = 2
const SCENE_WIDE_SHARE = 0.5
const WARM_SHARE = 0.75
const GAP_MIN_DAYS = 3 * NISAR_REPEAT_DAYS
export const QUIET_RADIUS_KM = 0.5
const CLOUD_CROP: CropOptions = { minSpanM: 3000, marginShare: 0.5, aspect: 1 }

const RANK: Readonly<Record<Confidence, number>> = { high: 0, medium: 1, low: 2 }

const LABEL_CONFIDENCE: Readonly<Record<NullLabel, Confidence>> = {
  beats_all: 'high',
  borderline: 'medium',
  like_open_ground: 'low',
}

type EventKind = 'frost' | 'forest' | 'fields' | 'water'

const KIND_OF_TYPE: Readonly<Record<EventType, EventKind>> = {
  forest_loss: 'forest',
  harvest: 'fields',
  frost: 'frost',
  new_water: 'water',
  flood: 'water',
}

interface CloudInsetPick {
  readonly type: EventType
  readonly from: string
  readonly to: string
}

const CLOUD_INSETS: readonly CloudInsetPick[] = [
  { type: 'forest_loss', from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' },
]

const nonNull = <T>(value: T | null): value is T => value !== null
const byTime = (a: StoryItem, b: StoryItem) => Date.parse(a.time) - Date.parse(b.time)
const kept = (e: ChangeEvent) => e.confidence !== 'low' && e.caveats.length === 0
const byArea = (a: ChangeEvent, b: ChangeEvent) =>
  RANK[a.confidence] - RANK[b.confidence] || b.area_ha - a.area_ha
const byDrop = (a: ChangeEvent, b: ChangeEvent) =>
  RANK[a.confidence] - RANK[b.confidence] || Math.abs(b.magnitude_db) - Math.abs(a.magnitude_db)
const byActivity = (a: ActivityEvent, b: ActivityEvent) =>
  RANK[a.confidence] - RANK[b.confidence] || b.area_m2 - a.area_m2
const roundTenth = (value: number) => Math.round(value * TENTHS) / TENTHS

const refOf = (f: RadarFrame): PassRef => ({
  time: f.time,
  track: f.track,
  direction: f.direction,
  scene: f.scene,
})

const bboxCorners = ([west, south, east, north]: BBox): Corners => [
  [west, north],
  [east, north],
  [east, south],
  [west, south],
]

const centreOf = (data: PlaceData): LonLat => [data.catalog.place.lon, data.catalog.place.lat]

const stableId = (kind: ChangeKind, time: string, [lon, lat]: LonLat) =>
  `${kind}-${time.slice(0, 10)}-${lon.toFixed(3)}-${lat.toFixed(3)}`

export function frameAt(frames: readonly RadarFrame[], time: string): number | null {
  const t = Date.parse(time)
  const index = frames.findIndex((f) => Math.abs(Date.parse(f.time) - t) <= PASS_MATCH_MS)
  return index === -1 ? null : index
}

export function sameTrackBefore(frames: readonly RadarFrame[], index: number): number | null {
  const after = frames[index]
  if (after === undefined) return null
  for (let i = index - 1; i >= 0; i--) {
    const f = frames[i]
    if (f?.track === after.track && f.direction === after.direction) return i
  }
  return null
}

function cloudyOn(data: PlaceData, time: string): CloudDay | null {
  const clouds = data.clouds
  const day = clouds?.days.find((d) => d.day === time.slice(0, 10))
  if (clouds === null || day?.frame == null || day.cloud_fraction === null) return null
  return day.cloud_fraction >= clouds.cloudy_day_min_fraction ? day : null
}

function temperatureAt(data: PlaceData, time: string): number | null {
  const t = Date.parse(time)
  const pass = data.weather?.passes.find((p) => Math.abs(Date.parse(p.time) - t) <= PASS_MATCH_MS)
  return pass?.t2m_c ?? null
}

function viewShare(areaHa: number, corners: Corners): number {
  const { widthM, heightM } = groundSizeM(corners)
  return (areaHa * M2_PER_HA) / (widthM * heightM)
}

function cloudTile(
  data: PlaceData,
  radar: RadarMeta,
  bbox: BBox,
  time: string,
  afterIndex: number,
): CloudTile | null {
  const clouds = data.clouds
  const day = cloudyOn(data, time)
  const after = radar.frames[afterIndex]
  if (clouds === null || day?.frame == null || day.cloud_fraction === null) return null
  if (after === undefined) return null
  const optical = cropAround(bboxCorners(clouds.bbox_lonlat), bbox, CLOUD_CROP)
  const onRadar = cropAround(radar.corners_lonlat, bbox, CLOUD_CROP)
  return {
    variant: 'clouds',
    optical: { path: day.frame, time: `${day.day}T12:00:00Z`, from: null },
    opticalCrop: optical.crop,
    opticalOutline: optical.outline,
    radar: { path: after.frame, time: after.time, from: null },
    radarCrop: onRadar.crop,
    outline: onRadar.outline,
    cloudShare: day.cloud_fraction,
  }
}

function cloudInset(e: ChangeEvent): boolean {
  const t = Date.parse(e.first_pass)
  return CLOUD_INSETS.some(
    (p) => p.type === e.type && t >= Date.parse(p.from) && t < Date.parse(p.to),
  )
}

function eventItem(
  data: PlaceData,
  radar: RadarMeta,
  event: ChangeEvent,
  ownsFrostMask: boolean,
): StoryItem | null {
  const frames = radar.frames
  const afterIndex = frameAt(frames, event.first_pass)
  const beforeIndex = afterIndex === null ? null : sameTrackBefore(frames, afterIndex)
  const after = afterIndex === null ? undefined : frames[afterIndex]
  const before = beforeIndex === null ? undefined : frames[beforeIndex]
  if (afterIndex === null || after === undefined || before === undefined) return null
  const kind = KIND_OF_TYPE[event.type]
  const corners = radar.corners_lonlat
  const box = bboxRect(corners, event.bbox)
  const sceneWide = box.w * box.h >= SCENE_WIDE_SHARE
  const { crop, outline } = cropAround(corners, event.bbox)
  const colour = kind === 'forest' ? 'false' : 'grey'
  const image = (f: RadarFrame): TileImage => ({
    path: colour === 'false' ? f.false_colour : f.frame,
    time: f.time,
    from: null,
  })
  const tile: RadarTile = {
    variant: 'radar',
    colour,
    before: image(before),
    after: image(after),
    crop,
    outline: sceneWide ? null : outline,
    mask: kind === 'frost' && ownsFrostMask ? (data.events?.masks.frost ?? null) : null,
  }
  const clouds = cloudTile(data, radar, event.bbox, after.time, afterIndex)
  const lonLat: LonLat = [event.lon, event.lat]
  const base = {
    id: stableId(kind, after.time, lonLat),
    n: null,
    time: after.time,
    frame: afterIndex,
    lonLat,
    bbox: event.bbox,
    areaHa: sceneWide ? null : event.area_ha,
    where: sceneWide
      ? ({ kind: 'view', share: viewShare(event.area_ha, corners) } as const)
      : whereFrom(centreOf(data), lonLat),
    confidence: event.confidence,
    flags: {
      early: event.maturity.length > 0 && event.maturity.every((m) => m === 'BETA'),
      estimate: kind === 'frost',
    },
    tile,
    insetTile: clouds !== null && cloudInset(event) ? clouds : tile,
    clouds,
    source: { product: 'GCOV', passes: [refOf(before), refOf(after)] },
  } as const
  return kind === 'frost'
    ? { ...base, kind, event, tempC: temperatureAt(data, after.time) }
    : { ...base, kind, event }
}

const passList = (passes: readonly PassRef[]): PassList | null => {
  const [first, ...rest] = passes
  return first === undefined ? null : [first, ...rest]
}

function gslcRefs(insar: InsarMeta, pairs: readonly ActivityPair[]): PassList | null {
  const seen = new Map<string, PassRef>()
  for (const pair of pairs) {
    const [fromScene, toScene] = pair.scenes
    if (fromScene === undefined || toScene === undefined) return null
    for (const [time, scene] of [
      [pair.from, fromScene],
      [pair.to, toScene],
    ] as const) {
      seen.set(time, { time, track: insar.track, direction: insar.direction, scene })
    }
  }
  return passList([...seen.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)))
}

function reworkTile(
  radar: RadarMeta,
  insar: InsarMeta,
  activity: ActivityEvent,
  bbox: BBox,
): { readonly tile: Tile; readonly source: SourceRef } | null {
  const pair = insar.activity[activity.pair]
  const previous = insar.activity[activity.pair - 1]
  if (pair === undefined) return null
  const pairPasses = previous === undefined ? null : gslcRefs(insar, [previous, pair])
  if (previous !== undefined && !previous.weather_suspect && pairPasses !== null) {
    const { crop, outline } = cropAround(insar.corners_lonlat, bbox)
    return {
      tile: {
        variant: 'coherence',
        before: { path: previous.coherence_frame, time: previous.to, from: previous.from },
        after: { path: pair.coherence_frame, time: pair.to, from: pair.from },
        crop,
        outline,
      },
      source: { product: 'GSLC', passes: pairPasses },
    }
  }
  const beforeIndex = frameAt(radar.frames, activity.from)
  const afterIndex = frameAt(radar.frames, activity.to)
  const before = beforeIndex === null ? undefined : radar.frames[beforeIndex]
  const after = afterIndex === null ? undefined : radar.frames[afterIndex]
  if (before === undefined || after === undefined) return null
  const { crop, outline } = cropAround(radar.corners_lonlat, bbox)
  const image = (f: RadarFrame): TileImage => ({ path: f.frame, time: f.time, from: null })
  return {
    tile: {
      variant: 'radar',
      colour: 'grey',
      before: image(before),
      after: image(after),
      crop,
      outline,
      mask: null,
    },
    source: { product: 'GCOV', passes: [refOf(before), refOf(after)] },
  }
}

function reworkItem(
  data: PlaceData,
  radar: RadarMeta,
  insar: InsarMeta,
  activity: ActivityEvent,
): StoryItem | null {
  const pair = insar.activity[activity.pair]
  const frame = frameAt(radar.frames, activity.to)
  const lonLat: LonLat = [activity.lon, activity.lat]
  const bbox = squareBBox(lonLat, activity.area_m2)
  const drawn = reworkTile(radar, insar, activity, bbox)
  if (pair === undefined || frame === null || drawn === null) return null
  return {
    id: stableId('rework', activity.to, lonLat),
    n: null,
    kind: 'rework',
    time: activity.to,
    frame,
    lonLat,
    bbox,
    areaHa: activity.area_m2 / M2_PER_HA,
    where: whereFrom(centreOf(data), lonLat),
    confidence: activity.confidence,
    flags: { early: false, estimate: false },
    tile: drawn.tile,
    insetTile: drawn.tile,
    clouds: cloudTile(data, radar, bbox, activity.to, frame),
    source: drawn.source,
    activity,
    pair,
  }
}

function warmCount(temps: readonly (number | null)[], hot: number, cold: number): number {
  const hotC = temps[hot]
  const coldC = temps[cold]
  if (hotC == null || coldC == null) return 0
  const threshold = coldC + WARM_SHARE * (hotC - coldC)
  return temps.filter((t) => t !== null && t >= threshold).length
}

export function heatOrbit(
  objects: Objects,
  object: MotionObject,
  part: OrbitPart,
): HeatOrbit | null {
  for (const [key, series] of Object.entries(objects.tracks)) {
    const track = object.tracks[key]
    if (track === undefined || orbitPart(series.direction) !== part) continue
    const coldMm = track.los_mm[series.cold_pass] ?? null
    const passes = series.passes.flatMap((time, i): HeatPass[] => {
      const scene = series.scenes[i]
      const mm = track.los_mm[i] ?? null
      if (scene === undefined) return []
      const losMmFromColdest = mm === null || coldMm === null ? null : roundTenth(mm - coldMm)
      return [{ time, scene, tempC: series.temperature_c[i] ?? null, losMmFromColdest }]
    })
    if (passes.length !== series.passes.length) return null
    return {
      key,
      track: series.track,
      direction: series.direction,
      part,
      passes,
      hot: series.hot_pass,
      cold: series.cold_pass,
      warmPasses: warmCount(series.temperature_c, series.hot_pass, series.cold_pass),
      hotColdMm: track.hot_cold_mm,
      hotColdErrMm: track.hot_cold_err_mm,
      mmPerC: track.mm_per_c,
      mmPerCErr: track.mm_per_c_err,
    }
  }
  return null
}

export const heatOf = (objects: Objects, object: MotionObject): Heat => ({
  object,
  evening: heatOrbit(objects, object, 'evening'),
  dawn: heatOrbit(objects, object, 'dawn'),
})

/** Positive slopes only: for a negative slope loMm moves away from zero and overstates the sinking. */
export function heatRange(orbit: HeatOrbit, errorScale: number): HeatRange | null {
  const { mmPerC, mmPerCErr } = orbit
  const fitted = orbit.passes.filter((p) => p.losMmFromColdest !== null && p.tempC !== null)
  const temps = fitted.flatMap((p) => (p.tempC === null ? [] : [p.tempC]))
  if (mmPerC === null || mmPerCErr === null || temps.length < 2) return null
  const rangeC = Math.max(...temps) - Math.min(...temps)
  const mm = mmPerC * rangeC
  return {
    loMm: Math.round(mm - mmPerCErr * errorScale * rangeC),
    hiMm: Math.round(mm),
    mmPerC,
    mmPerCErr,
    rangeC,
    passes: fitted.length,
  }
}

function eveningTrack(objects: Objects, object: MotionObject): ObjectTrack | null {
  const key = Object.entries(objects.tracks).find(([, t]) => t.direction === EVENING_ORBIT)?.[0]
  return key === undefined ? null : (object.tracks[key] ?? null)
}

interface StoryBuilding {
  readonly object: MotionObject
  readonly label: NullLabel
}

function storyBuilding(data: PlaceData): StoryBuilding | null {
  const objects = data.objects
  const labels = data.nullCheck?.objects
  if (objects === null || labels === undefined) return null
  const clear = new Map(
    labels.filter((l) => l.label === 'beats_all').map((l): [string, NullLabel] => [l.osm, l.label]),
  )
  const [best] = objects.objects
    .filter((o) => clear.has(o.osm) && (eveningTrack(objects, o)?.mm_per_c ?? 0) > 0)
    .sort((a, b) => b.area_m2 - a.area_m2)
  const label = best === undefined ? undefined : clear.get(best.osm)
  return best === undefined || label === undefined ? null : { object: best, label }
}

function footprintBBox(data: PlaceData, osm: string): BBox | null {
  const feature = data.footprints?.features.find((f) => f.properties.osm === osm)
  if (feature === undefined) return null
  const geometry = feature.geometry
  const points = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates
  const lons = points.flatMap(([lon]) => (lon === undefined ? [] : [lon]))
  const lats = points.flatMap(([, lat]) => (lat === undefined ? [] : [lat]))
  if (lons.length === 0 || lats.length === 0) return null
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

const orbitPasses = (orbit: HeatOrbit): PassList | null =>
  passList(
    orbit.passes.map((p) => ({
      time: p.time,
      track: orbit.track,
      direction: orbit.direction,
      scene: p.scene,
    })),
  )

function heatItem(data: PlaceData, radar: RadarMeta): StoryItem | null {
  const objects = data.objects
  const building = storyBuilding(data)
  if (objects === null || building === null) return null
  const { object } = building
  const heat = heatOf(objects, object)
  const evening = heat.evening
  if (evening === null) return null
  const range = heatRange(evening, data.nullCheck?.error_inflation ?? 1)
  const passes = orbitPasses(evening)
  const cold = evening.passes[evening.cold]
  const frame = cold === undefined ? null : frameAt(radar.frames, cold.time)
  if (range === null || passes === null) return null
  if (cold === undefined || frame === null) return null
  const lonLat: LonLat = [object.lon, object.lat]
  const tile: ChartTile = { variant: 'chart', heat }
  return {
    id: `heat-${object.osm}`,
    n: null,
    kind: 'heat',
    time: cold.time,
    frame,
    lonLat,
    bbox: footprintBBox(data, object.osm) ?? squareBBox(lonLat, object.area_m2),
    areaHa: object.area_m2 / M2_PER_HA,
    where: whereFrom(centreOf(data), lonLat),
    confidence: LABEL_CONFIDENCE[building.label],
    flags: { early: false, estimate: true },
    tile,
    insetTile: tile,
    clouds: null,
    source: { product: 'GSLC', passes },
    heat,
    range,
  }
}

function dataGap(data: PlaceData): DataGap | null {
  const frames = data.radar?.frames ?? []
  const listed = (data.catalog.granules ?? []).filter((g) => g.level === 'GCOV').map((g) => g.start)
  const times = [...new Set(listed.length > 0 ? listed : frames.map((f) => f.time))].sort(
    (a, b) => Date.parse(a) - Date.parse(b),
  )
  let gap: { from: string; to: string } | null = null
  let longest = GAP_MIN_DAYS * DAY_MS
  for (const [i, to] of times.entries()) {
    const from = times[i - 1]
    if (from === undefined) continue
    const span = Date.parse(to) - Date.parse(from)
    if (span >= longest) {
      longest = span
      gap = { from, to }
    }
  }
  if (gap === null) return null
  const cut = Date.parse(gap.from)
  const lastBefore = frames.findLastIndex((f) => Date.parse(f.time) <= cut)
  const firstAfter = lastBefore + 1
  if (lastBefore === -1 || firstAfter >= frames.length) return null
  return { ...gap, lastBefore, firstAfter }
}

function weatherSetAside(insar: InsarMeta | null): WeatherSetAside | null {
  const events = insar?.activity_events ?? []
  const suspects = events.filter((e) => e.weather_suspect)
  const froms = suspects.map((e) => e.from).sort((a, b) => Date.parse(a) - Date.parse(b))
  const tos = suspects.map((e) => e.to).sort((a, b) => Date.parse(a) - Date.parse(b))
  const from = froms[0]
  const to = tos.at(-1)
  if (from === undefined || to === undefined) return null
  return { setAside: suspects.length, total: events.length, from, to }
}

function backgroundTrack(frames: readonly RadarFrame[]): TrackRef | null {
  const counts = new Map<string, { ref: TrackRef; count: number }>()
  for (const f of frames) {
    const key = `${String(f.track)}${f.direction}`
    const entry = counts.get(key) ?? { ref: { track: f.track, direction: f.direction }, count: 0 }
    counts.set(key, { ref: entry.ref, count: entry.count + 1 })
  }
  let best: { ref: TrackRef; count: number } | null = null
  for (const entry of counts.values()) if (best === null || entry.count > best.count) best = entry
  return best?.ref ?? null
}

export function backgroundFrame(
  frames: readonly RadarFrame[],
  background: TrackRef | null,
  frame: number,
): number {
  if (background === null) return frame
  const matches = (f: RadarFrame | undefined) =>
    f?.track === background.track && f.direction === background.direction
  for (let i = Math.min(frame, frames.length - 1); i >= 0; i--) if (matches(frames[i])) return i
  const first = frames.findIndex(matches)
  return first === -1 ? frame : first
}

export function buildStory(data: PlaceData): Story {
  const radar = data.radar
  const frames = radar?.frames ?? []
  const size = radar === null ? null : groundSizeM(radar.corners_lonlat)
  const background = backgroundTrack(frames)
  const shared = {
    gap: dataGap(data),
    weather: weatherSetAside(data.insar),
    clouds:
      data.clouds === null
        ? null
        : { cloudyDays: data.clouds.cloudy_days, passDays: data.clouds.pass_days },
    passes: frames.length,
    background,
    restFrame: frames.length === 0 ? 0 : backgroundFrame(frames, background, frames.length - 1),
    pixelM: radar?.pixel_m ?? null,
    viewKm:
      size === null ? null : { width: size.widthM / M_PER_KM, height: size.heightM / M_PER_KM },
  }
  if (radar === null) return { ...shared, chapters: [], changes: [], secondary: [] }
  const events = (data.events?.events ?? []).filter(kept)
  const chosen = new Set([
    ...events
      .filter((e) => e.type === 'frost')
      .sort(byDrop)
      .slice(0, 1),
    ...events
      .filter((e) => e.type === 'forest_loss')
      .sort(byArea)
      .slice(0, FOREST_CHAPTERS),
    ...events
      .filter((e) => e.type === 'harvest')
      .sort(byArea)
      .slice(0, 1),
  ])
  const insar = data.insar
  const activity =
    insar === null
      ? []
      : insar.activity_events
          .filter((a) => !a.weather_suspect && a.confidence !== 'low')
          .sort(byActivity)
  const rework = (a: ActivityEvent) => (insar === null ? null : reworkItem(data, radar, insar, a))
  const chapters = [
    ...[...chosen].map((e) => eventItem(data, radar, e, true)),
    ...activity.slice(0, 1).map(rework),
    heatItem(data, radar),
  ]
    .filter(nonNull)
    .sort(byTime)
    .map((item, i): Chapter => ({ ...item, n: i + 1 }))
  const secondary = [
    ...events.filter((e) => !chosen.has(e)).map((e) => eventItem(data, radar, e, false)),
    ...activity.slice(1).map(rework),
  ]
    .filter(nonNull)
    .sort(byTime)
  return { ...shared, chapters, changes: chapters.filter((c) => c.kind !== 'heat'), secondary }
}

export const chapterAt = (story: Story, frame: number): Chapter | null =>
  story.chapters.find((c) => c.frame === frame) ?? null

export const chapterByNumber = (story: Story, n: number): Chapter | null =>
  story.chapters.find((c) => c.n === n) ?? null

export const itemById = (story: Story, id: string): StoryItem | null =>
  story.chapters.find((c) => c.id === id) ?? story.secondary.find((s) => s.id === id) ?? null

export function displayFrame(
  story: Story,
  frames: readonly RadarFrame[],
  frame: number,
  focus: StoryItem | null,
): number {
  if (focus !== null) return focus.frame
  if (chapterAt(story, frame) !== null) return frame
  return backgroundFrame(frames, story.background, frame)
}

export function playStartFrame(data: PlaceData, mode: 'people' | 'business'): number {
  const frames = data.radar?.frames ?? []
  if (mode === 'people') return 0
  const [first] = Object.values(data.objects?.tracks ?? {})
    .filter((t) => t.direction === EVENING_ORBIT)
    .flatMap((t) => t.passes.slice(0, 1))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
  if (first === undefined) return 0
  const index = frames.findIndex((f) => Date.parse(f.time) >= Date.parse(first))
  return index === -1 ? 0 : index
}
