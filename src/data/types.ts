import type { FeatureCollection, LineString, Polygon } from 'geojson'

export type Direction = 'ASCENDING' | 'DESCENDING'

export interface PassRef {
  readonly time: string
  readonly track: number
  readonly direction: Direction
  readonly scene: string
}

export interface RadarFrame extends PassRef {
  readonly frame: string
  readonly false_colour: string
}

export interface SharpenStep {
  readonly looks: number
  readonly frame: string
  readonly false_colour: string
  readonly until: string
}

export type LonLatPair = readonly [lon: number, lat: number]

export type Corners = readonly [
  topLeft: LonLatPair,
  topRight: LonLatPair,
  bottomRight: LonLatPair,
  bottomLeft: LonLatPair,
]

export type BBox = readonly [west: number, south: number, east: number, north: number]

export type Maturity = 'BETA' | 'PROVISIONAL' | 'VALIDATED'

export interface RadarMeta {
  readonly place: string
  readonly corners_lonlat: Corners
  readonly level: string
  readonly pixel_m: number
  readonly frames: readonly RadarFrame[]
  readonly sharpen: { readonly track: number; readonly steps: readonly SharpenStep[] }
  readonly source: string
}

export interface PlayFrame extends PassRef {
  readonly frame: string
  readonly full_frame: string
}

export interface PlayMeta {
  readonly place: string
  readonly level: string
  readonly pixel_m: number
  readonly out_px: number
  readonly full_out_px: number
  readonly frames: readonly PlayFrame[]
}

export interface ProjectedPass {
  readonly track: number
  readonly direction: Direction
  readonly time: string
  readonly projected: boolean
}

export interface TrackFootprint {
  readonly track: number
  readonly direction: Direction
  readonly frame: number
  readonly footprint: Polygon
  readonly last: string
}

export interface Granule {
  readonly scene: string
  readonly level: string
  readonly start: string
  readonly track: number
  readonly direction: Direction
}

export interface Catalog {
  readonly place: {
    readonly slug: string
    readonly name: string
    readonly country: string
    readonly lat: number
    readonly lon: number
  }
  readonly counts: Readonly<Record<'GCOV' | 'GSLC' | 'GUNW' | 'SME2', number>>
  readonly schedule: {
    readonly tracks: readonly TrackFootprint[]
    readonly pending: readonly ProjectedPass[]
    readonly upcoming: readonly ProjectedPass[]
  }
  readonly granules?: readonly Granule[]
}

export interface CloudDay {
  readonly day: string
  readonly frame: string | null
  readonly cloud_fraction: number | null
}

export interface Clouds {
  readonly pass_days: number
  readonly days_with_optical: number
  readonly cloudy_days: number
  readonly cloudy_day_min_fraction: number
  readonly estimate: boolean
  readonly source: string
  readonly bbox_lonlat: BBox
  readonly days: readonly CloudDay[]
}

export interface WeatherPass {
  readonly time: string
  readonly t2m_c: number | null
  readonly precip_24h_mm: number | null
  readonly snow_depth_cm: number | null
}

export interface Weather {
  readonly source: string
  readonly passes: readonly WeatherPass[]
}

export type Confidence = 'high' | 'medium' | 'low'

export interface ActivityPair {
  readonly from: string
  readonly to: string
  readonly scenes: readonly string[]
  readonly frame: string
  readonly coherence_frame: string
  readonly weather_suspect: boolean
  readonly weather_reason: string | null
  readonly stable_coherence: number
  readonly mean_coherence: number
}

export interface ActivityEvent {
  readonly pair: number
  readonly from: string
  readonly to: string
  readonly scenes: readonly string[]
  readonly area_m2: number
  readonly typical_coherence: number
  readonly pair_coherence: number
  readonly anomaly: number
  readonly weather_suspect: boolean
  readonly confidence: Confidence
  readonly lon: number
  readonly lat: number
}

export interface InsarMeta {
  readonly track: number
  readonly direction: Direction
  readonly crid: string
  readonly passes: readonly string[]
  readonly scenes: readonly string[]
  readonly corners_lonlat: Corners
  readonly activity: readonly ActivityPair[]
  readonly activity_events: readonly ActivityEvent[]
  readonly median_noise_mm: number | null
  readonly source: string
}

export interface TrackSeries {
  readonly track: number
  readonly direction: Direction
  readonly passes: readonly string[]
  readonly scenes: readonly string[]
  readonly temperature_c: readonly (number | null)[]
  readonly hot_pass: number
  readonly cold_pass: number
}

export interface ObjectTrack {
  readonly coherence: number
  /** Positive towards the satellite (shorter range), relative to the first pass of the track. */
  readonly los_mm: readonly (number | null)[]
  readonly mm_per_c: number | null
  readonly mm_per_c_err: number | null
  readonly resid_mm: number | null
  readonly hot_cold_mm: number | null
  readonly hot_cold_err_mm: number | null
}

export interface MotionObject {
  readonly osm: string
  readonly kind: 'building' | 'bridge' | 'levee'
  readonly name: string | null
  readonly building?: string | null
  readonly area_m2: number
  readonly lon: number
  readonly lat: number
  readonly tracks: Readonly<Record<string, ObjectTrack>>
  readonly vertical_consistent: boolean | null
  /** Positive towards the satellite (shorter range); a roof that rises in heat has mm_per_c > 0. */
  readonly mm_per_c: number | null
  readonly mm_per_c_err: number | null
}

export interface Objects {
  readonly crid: string
  readonly level: string
  readonly los_sign_verified: boolean
  readonly temperature_estimate: boolean
  readonly tracks: Readonly<Record<string, TrackSeries>>
  readonly objects: readonly MotionObject[]
  readonly attribution: string
}

export interface FootprintProps {
  readonly osm: string
  readonly name: string | null
  readonly kind: MotionObject['kind']
  readonly area_m2: number
  readonly mm_per_c: number | null
  readonly mm_per_c_err: number | null
  readonly mm_per_c_track: string | null
  readonly vertical_consistent: boolean | null
  readonly coherence: number
}

export type ObjectFootprints = FeatureCollection<Polygon | LineString, FootprintProps> & {
  readonly attribution: string
  readonly temperature_estimate: boolean
}

export type EventType = 'forest_loss' | 'new_water' | 'flood' | 'harvest' | 'frost'

export interface ChangeEvent {
  /** Serial per type in pipeline order; shifts when events are added or removed, so never a stable key. */
  readonly id: string
  readonly type: EventType
  readonly metric: 'HV' | 'HH'
  readonly before_pass: string
  readonly first_pass: string
  readonly last_pass: string
  /** Track of the largest member detection; the frame drawn at first_pass can be another track. */
  readonly track: number
  readonly tracks: readonly number[]
  readonly direction: Direction
  readonly directions: readonly Direction[]
  readonly area_ha: number
  readonly lon: number
  readonly lat: number
  readonly bbox: BBox
  readonly magnitude_db: number
  readonly before_db: number
  readonly after_db: number
  readonly passes: number
  readonly confidence: Confidence
  readonly caveats: readonly string[]
  readonly maturity: readonly Maturity[]
  readonly scenes: readonly string[]
  readonly weather_excluded_passes: number
}

export interface Events {
  readonly corners_lonlat: Corners
  readonly masks: {
    readonly forest_loss: string
    readonly water: string
    readonly fields: string
    readonly frost: string
  }
  readonly events: readonly ChangeEvent[]
}

export type NullLabel = 'beats_all' | 'borderline' | 'like_open_ground'

export type TrackNumberKey = `${number}`

export interface NullCheckObject {
  readonly osm: string
  readonly z: Readonly<Partial<Record<TrackNumberKey, number | null>>>
  readonly squares_same_direction: number
  readonly squares_any_direction: number
  readonly label: NullLabel
}

export interface NullCheck {
  readonly method: Readonly<Record<string, unknown>>
  readonly generated_from: readonly string[]
  readonly passes_per_track: number
  readonly seed: number
  readonly squares_coherent_both: number
  readonly same_sign_share: number
  readonly both_beyond_2_same_sign_share: number
  readonly z_p95: Readonly<Partial<Record<TrackNumberKey, number>>>
  readonly t_expected_p95: number
  readonly error_inflation: number
  readonly histogram: { readonly bin_edges: readonly number[]; readonly counts: readonly number[] }
  readonly objects: readonly NullCheckObject[]
  readonly temperature_estimate: boolean
  readonly source: string
}

export interface StripWindow {
  readonly track: number
  readonly direction: Direction
  readonly before_pass: string
  readonly first_pass: string
}

export interface StripPatch {
  readonly id: string
  readonly lon: number
  readonly lat: number
  readonly bbox: BBox
  readonly area_ha: number
  readonly drop_db: Readonly<Record<string, number>>
  readonly windows: readonly StripWindow[]
}

export interface StripCuts {
  readonly place: string
  readonly generated_from: readonly string[]
  readonly corners_lonlat: Corners
  readonly mask: string
  readonly method: string
  readonly before_pass: string
  readonly first_pass: string
  readonly tracks: readonly number[]
  readonly count: number
  readonly area_ha: number
  readonly median_drop_db: number
  readonly confidence: Confidence
  readonly patches: readonly StripPatch[]
  readonly not_claimed: readonly string[]
  readonly source: string
}

export interface StoryNumber {
  readonly value: number
  readonly unit: string
  readonly range: readonly [low: number, high: number] | null
}

export interface StoryPass {
  readonly image: string
  readonly date: string
  readonly product: string
  readonly track: number
  readonly direction: Direction
  readonly scene: string
}

export interface StoryOverlay {
  readonly image: string
  readonly corners_lonlat: Corners
}

export interface StorySeries {
  readonly dates: readonly string[]
  readonly values: readonly number[]
  readonly unit: string
}

export interface StoryChapterRecord {
  readonly id: string
  readonly kind: string
  readonly date: string
  readonly window: { readonly from: string; readonly to: string }
  readonly confidence: Confidence
  readonly numbers: Readonly<Record<string, StoryNumber>>
  readonly before: StoryPass
  readonly after: StoryPass
  readonly overlay: StoryOverlay | null
  readonly focus_bbox: BBox
  readonly chart: { readonly series: readonly StorySeries[] } | null
  readonly caveats: readonly string[]
}

export interface PlaceStory {
  readonly place: string
  readonly generated_from: readonly string[]
  readonly chapters: readonly StoryChapterRecord[]
}

export interface GroundPair {
  readonly from: string
  readonly to: string
  readonly days: number
  readonly scene: string
}

export interface Ground {
  readonly place: string
  readonly product: string
  readonly track: number
  readonly direction: Direction
  readonly crid: string
  readonly passes: readonly string[]
  readonly span_days: number
  readonly pairs: readonly GroundPair[]
  readonly atmosphere_corrected: boolean
  readonly pixel_m: number
  readonly reference: { readonly name: string }
  readonly district: {
    readonly name: string
    readonly osm: string
    readonly median_cm: number
    readonly p10_cm: number
    readonly p90_cm: number
  }
  readonly map: {
    readonly path: string
    readonly corners_lonlat: Corners
    readonly max_cm: number
    readonly pixel_m: number
    readonly ramp: readonly (readonly [cm: number, colour: string])[]
  }
  readonly source: string
}

export interface EventPass {
  readonly time: string
  readonly scene: string
}

export interface EventOrbit {
  readonly track: number
  readonly direction: Direction
  readonly before: EventPass
  readonly after: EventPass
  readonly change_map: string
}

export interface EventInterferogram {
  readonly role: string
  readonly scene: string
  readonly track: number
  readonly direction: Direction
  readonly first_pass: string
  readonly second_pass: string
  readonly fringes: string
}

export interface VolcanoEvent {
  readonly orbits: readonly EventOrbit[]
  readonly interferograms: readonly EventInterferogram[]
  readonly overlay_pixel_m: number
}

export interface EventGunwPair {
  readonly role: string
  readonly scene: string
  readonly level: string
  readonly track: number
  readonly direction: Direction
  readonly reference_time: string
  readonly secondary_time: string
  readonly los_map?: string
  readonly los_pixel_m?: number
}

export interface QuakeEvent {
  readonly gunw: { readonly pairs: readonly EventGunwPair[] }
}

export interface FloodEvent {
  readonly track: number
  readonly direction: Direction
  readonly before: EventPass
  readonly after: EventPass
  readonly masks: { readonly new_water: string; readonly pixel_m: number }
}

export type PairRole = 'event' | 'control'

export interface MeasuredPair {
  readonly role: PairRole
  readonly product: string
  readonly track: number
  readonly direction: Direction
  readonly from: string
  readonly to: string
  readonly pairs: number
  readonly scenes: readonly string[]
  readonly image: string | null
  readonly pixelM: number | null
}

export interface PlaceData {
  readonly slug: string
  readonly catalog: Catalog
  readonly radar: RadarMeta | null
  readonly clouds: Clouds | null
  readonly weather: Weather | null
  readonly insar: InsarMeta | null
  readonly objects: Objects | null
  readonly events: Events | null
  readonly footprints: ObjectFootprints | null
  readonly nullCheck: NullCheck | null
  readonly story: PlaceStory | null
  readonly ground: Ground | null
  readonly play: PlayMeta | null
  readonly eventPairs: readonly MeasuredPair[] | null
}
