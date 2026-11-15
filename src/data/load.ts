import type {
  Catalog,
  Direction,
  Events,
  Clouds,
  EventPass,
  FloodEvent,
  Ground,
  InsarMeta,
  MeasuredPair,
  NullCheck,
  ObjectFootprints,
  Objects,
  PairRole,
  PlaceData,
  PlaceStory,
  PlayMeta,
  QuakeEvent,
  RadarMeta,
  StripCuts,
  VolcanoEvent,
  Weather,
} from '#web/data/types.ts'
import { type PlaceFile, PLACES } from '#web/places.ts'

export const dataUrl = (slug: string, path: string): string => `/data/${slug}/${path}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const numbers = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every((key) => typeof value[key] === 'number')

const NULL_LABELS: readonly unknown[] = ['beats_all', 'borderline', 'like_open_ground']
const CORNER_COUNT = 4

const isPair = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number')

export const isRadarMeta = (value: unknown): value is RadarMeta =>
  isRecord(value) &&
  Array.isArray(value.corners_lonlat) &&
  value.corners_lonlat.length === CORNER_COUNT &&
  value.corners_lonlat.every(isPair) &&
  Array.isArray(value.frames) &&
  isRecord(value.sharpen) &&
  typeof value.level === 'string' &&
  numbers(value, ['pixel_m'])

const isPlayFrame = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.time === 'string' &&
  typeof value.frame === 'string' &&
  typeof value.full_frame === 'string' &&
  typeof value.scene === 'string' &&
  typeof value.track === 'number' &&
  (value.direction === 'ASCENDING' || value.direction === 'DESCENDING')

export const isPlayMeta = (value: unknown): value is PlayMeta =>
  isRecord(value) &&
  typeof value.place === 'string' &&
  typeof value.level === 'string' &&
  numbers(value, ['pixel_m', 'out_px', 'full_out_px']) &&
  Array.isArray(value.frames) &&
  value.frames.every(isPlayFrame)

const isNullCheckObject = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.osm === 'string' &&
  isRecord(value.z) &&
  NULL_LABELS.includes(value.label)

export const isNullCheck = (value: unknown): value is NullCheck =>
  isRecord(value) &&
  Array.isArray(value.objects) &&
  value.objects.every(isNullCheckObject) &&
  isRecord(value.histogram) &&
  isRecord(value.z_p95) &&
  numbers(value, [
    'squares_coherent_both',
    'same_sign_share',
    'error_inflation',
    'passes_per_track',
  ])

const CONFIDENCES: readonly unknown[] = ['high', 'medium', 'low']
const DIRECTIONS: readonly unknown[] = ['ASCENDING', 'DESCENDING']
const BBOX_LENGTH = 4

const strings = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every((key) => typeof value[key] === 'string')

const isStringList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')

const isStoryNumber = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.value === 'number' &&
  typeof value.unit === 'string' &&
  (value.range === null || isPair(value.range))

const isStoryPass = (value: unknown): boolean =>
  isRecord(value) &&
  strings(value, ['image', 'date', 'product', 'scene']) &&
  typeof value.track === 'number' &&
  DIRECTIONS.includes(value.direction)

const isCorners = (value: unknown): boolean =>
  Array.isArray(value) && value.length === CORNER_COUNT && value.every(isPair)

const isStorySeries = (value: unknown): boolean =>
  isRecord(value) &&
  isStringList(value.dates) &&
  Array.isArray(value.values) &&
  value.values.every((v) => typeof v === 'number') &&
  typeof value.unit === 'string'

const isStoryChapter = (value: unknown): boolean =>
  isRecord(value) &&
  strings(value, ['id', 'kind', 'date']) &&
  isRecord(value.window) &&
  strings(value.window, ['from', 'to']) &&
  CONFIDENCES.includes(value.confidence) &&
  isRecord(value.numbers) &&
  Object.values(value.numbers).every(isStoryNumber) &&
  isStoryPass(value.before) &&
  isStoryPass(value.after) &&
  (value.overlay === null ||
    (isRecord(value.overlay) &&
      typeof value.overlay.image === 'string' &&
      isCorners(value.overlay.corners_lonlat))) &&
  Array.isArray(value.focus_bbox) &&
  value.focus_bbox.length === BBOX_LENGTH &&
  value.focus_bbox.every((v) => typeof v === 'number') &&
  (value.chart === null ||
    (isRecord(value.chart) &&
      Array.isArray(value.chart.series) &&
      value.chart.series.every(isStorySeries))) &&
  isStringList(value.caveats)

export const isPlaceStory = (value: unknown): value is PlaceStory =>
  isRecord(value) &&
  typeof value.place === 'string' &&
  isStringList(value.generated_from) &&
  Array.isArray(value.chapters) &&
  value.chapters.every(isStoryChapter)

const COLOUR = /^#[0-9a-f]{6}$/i

const isGroundPair = (value: unknown): boolean =>
  isRecord(value) && strings(value, ['from', 'to', 'scene']) && numbers(value, ['days'])

const isRampStop = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'string' &&
  COLOUR.test(value[1])

const isGroundMap = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.path === 'string' &&
  isCorners(value.corners_lonlat) &&
  numbers(value, ['max_cm', 'pixel_m']) &&
  Array.isArray(value.ramp) &&
  value.ramp.length > 1 &&
  value.ramp.every(isRampStop)

const isDistrict = (value: unknown): boolean =>
  isRecord(value) &&
  strings(value, ['name', 'osm']) &&
  numbers(value, ['median_cm', 'p10_cm', 'p90_cm'])

export const isGround = (value: unknown): value is Ground =>
  isRecord(value) &&
  strings(value, ['place', 'product', 'crid', 'source']) &&
  numbers(value, ['track', 'span_days', 'pixel_m']) &&
  DIRECTIONS.includes(value.direction) &&
  isStringList(value.passes) &&
  Array.isArray(value.pairs) &&
  value.pairs.every(isGroundPair) &&
  typeof value.atmosphere_corrected === 'boolean' &&
  isRecord(value.reference) &&
  typeof value.reference.name === 'string' &&
  isDistrict(value.district) &&
  isGroundMap(value.map)

const LOOK_PRODUCT = 'GCOV'
const INTERFEROGRAM_PRODUCT = 'GUNW'
const EVENT_ROLES: readonly string[] = ['co_event', 'coseismic']

const onTrack = (value: Record<string, unknown>): boolean =>
  typeof value.track === 'number' && DIRECTIONS.includes(value.direction)

const isEventPass = (value: unknown): boolean =>
  isRecord(value) && strings(value, ['time', 'scene'])

const isEventOrbit = (value: unknown): boolean =>
  isRecord(value) &&
  onTrack(value) &&
  isEventPass(value.before) &&
  isEventPass(value.after) &&
  typeof value.change_map === 'string'

const isInterferogram = (value: unknown): boolean =>
  isRecord(value) &&
  onTrack(value) &&
  strings(value, ['role', 'scene', 'first_pass', 'second_pass', 'fringes'])

const isVolcanoEvent = (value: unknown): value is VolcanoEvent =>
  isRecord(value) &&
  Array.isArray(value.orbits) &&
  value.orbits.every(isEventOrbit) &&
  Array.isArray(value.interferograms) &&
  value.interferograms.every(isInterferogram) &&
  numbers(value, ['overlay_pixel_m'])

const isGunwPair = (value: unknown): boolean =>
  isRecord(value) &&
  onTrack(value) &&
  strings(value, ['role', 'scene', 'level', 'reference_time', 'secondary_time']) &&
  (value.los_map === undefined ||
    (typeof value.los_map === 'string' && typeof value.los_pixel_m === 'number'))

const isQuakeEvent = (value: unknown): value is QuakeEvent =>
  isRecord(value) &&
  isRecord(value.gunw) &&
  Array.isArray(value.gunw.pairs) &&
  value.gunw.pairs.every(isGunwPair)

const isFloodEvent = (value: unknown): value is FloodEvent =>
  isRecord(value) &&
  onTrack(value) &&
  isEventPass(value.before) &&
  isEventPass(value.after) &&
  isRecord(value.masks) &&
  typeof value.masks.new_water === 'string' &&
  numbers(value.masks, ['pixel_m'])

const roleOf = (role: string): PairRole => (EVENT_ROLES.includes(role) ? 'event' : 'control')

interface LookPair {
  readonly track: number
  readonly direction: Direction
  readonly before: EventPass
  readonly after: EventPass
}

const looksPair = (look: LookPair, image: string, pixelM: number): MeasuredPair => ({
  role: 'event',
  product: LOOK_PRODUCT,
  track: look.track,
  direction: look.direction,
  from: look.before.time,
  to: look.after.time,
  pairs: 1,
  scenes: [look.before.scene, look.after.scene],
  image,
  pixelM,
})

function volcanoPairs(event: VolcanoEvent): readonly MeasuredPair[] {
  const pixelM = event.overlay_pixel_m
  return [
    ...event.orbits.map((orbit) => looksPair(orbit, orbit.change_map, pixelM)),
    ...event.interferograms.map((pair): MeasuredPair => ({
      role: roleOf(pair.role),
      product: INTERFEROGRAM_PRODUCT,
      track: pair.track,
      direction: pair.direction,
      from: pair.first_pass,
      to: pair.second_pass,
      pairs: 1,
      scenes: [pair.scene],
      image: pair.fringes,
      pixelM,
    })),
  ]
}

const quakePairs = (event: QuakeEvent): readonly MeasuredPair[] =>
  event.gunw.pairs.map((pair) => ({
    role: roleOf(pair.role),
    product: pair.level,
    track: pair.track,
    direction: pair.direction,
    from: pair.reference_time,
    to: pair.secondary_time,
    pairs: 1,
    scenes: [pair.scene],
    image: pair.los_map ?? null,
    pixelM: pair.los_pixel_m ?? null,
  }))

export function eventPairs(value: unknown): readonly MeasuredPair[] {
  if (isVolcanoEvent(value)) return volcanoPairs(value)
  if (isQuakeEvent(value)) return quakePairs(value)
  if (isFloodEvent(value)) return [looksPair(value, value.masks.new_water, value.masks.pixel_m)]
  throw new Error('event.json: unexpected shape')
}

export const isStripCuts = (value: unknown): value is StripCuts =>
  isRecord(value) &&
  Array.isArray(value.patches) &&
  typeof value.mask === 'string' &&
  numbers(value, ['count', 'area_ha'])

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  const html = response.headers.get('content-type')?.includes('text/html') ?? false
  if (!response.ok || html) return null
  return (await response.json()) as unknown
}

async function optional<T>(url: string | null): Promise<T | null> {
  return url === null ? null : ((await fetchJson(url)) as T | null)
}

async function checked<T>(
  url: string | null,
  guard: (value: unknown) => value is T,
): Promise<T | null> {
  if (url === null) return null
  const value = await fetchJson(url)
  if (value === null) return null
  if (!guard(value)) throw new Error(`${url}: unexpected shape`)
  return value
}

async function required<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export const loadRadar = (slug: string): Promise<RadarMeta | null> =>
  checked(dataUrl(slug, 'radar.json'), isRadarMeta)

export const loadStory = (slug: string): Promise<PlaceStory | null> =>
  checked(dataUrl(slug, 'story.json'), isPlaceStory)

async function loadEventPairs(url: string | null): Promise<readonly MeasuredPair[] | null> {
  const value = url === null ? null : await fetchJson(url)
  return value === null ? null : eventPairs(value)
}

export async function loadPlace(slug: string): Promise<PlaceData> {
  const shipped = new Set<PlaceFile>(PLACES.find((p) => p.slug === slug)?.files)
  const url = (file: PlaceFile): string | null => (shipped.has(file) ? dataUrl(slug, file) : null)
  const [
    catalog,
    radar,
    clouds,
    weather,
    insar,
    objects,
    events,
    footprints,
    nullCheck,
    story,
    ground,
    play,
    pairs,
  ] = await Promise.all([
    required<Catalog>(dataUrl(slug, 'catalog.json')),
    loadRadar(slug),
    optional<Clouds>(url('clouds.json')),
    optional<Weather>(url('weather.json')),
    optional<InsarMeta>(url('insar/insar.json')),
    optional<Objects>(url('insar/objects.json')),
    optional<Events>(url('events.json')),
    optional<ObjectFootprints>(url('insar/objects.geojson')),
    checked(url('insar/null_check.json'), isNullCheck),
    checked(url('story.json'), isPlaceStory),
    checked(url('ground.json'), isGround),
    checked(url('radar-play.json'), isPlayMeta),
    loadEventPairs(url('event.json')),
  ])
  return {
    slug,
    catalog,
    radar,
    clouds,
    weather,
    insar,
    objects,
    events,
    footprints,
    nullCheck,
    story,
    ground,
    play,
    eventPairs: pairs,
  }
}
