import type { Feature, LineString, Polygon } from 'geojson'
import type { BBox, Corners, PlaceData } from '#web/data/types.ts'
import { distanceKm } from '#web/film/geo.ts'
import { insideWatched } from '#web/map/frame.ts'
import { QUIET_RADIUS_KM, type Story, type StoryItem } from '#web/story/chapters.ts'
import { bboxRect, squareBBox } from '#web/story/crop.ts'
import { type ChangeKind, KIND_STYLE } from '#web/story/kinds.ts'
import { isTold } from '#web/story/place-story.ts'
import type { LonLat } from '#web/story/where.ts'

const SCENE_WIDE_SHARE = 0.5

export interface Pin {
  readonly id: string
  readonly kind: ChangeKind
  readonly lonLat: LonLat
  readonly frame: number
  readonly item: StoryItem
}

export interface PinView {
  readonly inPlay: boolean
  readonly frame: number
  readonly item: string | null
}

export interface OutlineProps {
  readonly colour: string
}

export interface Focus {
  readonly outline: Feature<Polygon | LineString, OutlineProps> | null
  readonly tag: LonLat | null
}

export type ClickTarget =
  | { readonly kind: 'item'; readonly id: string }
  | { readonly kind: 'quiet' }
  | { readonly kind: 'fog' }
  | { readonly kind: 'unanalysed' }
  | { readonly kind: 'none' }

const placed = (item: StoryItem) => item.where.kind !== 'view'

const pinned = (item: StoryItem) => placed(item) || isTold(item)

const pinOf = (item: StoryItem): Pin => ({
  id: item.id,
  kind: item.kind,
  lonLat: item.lonLat,
  frame: item.frame,
  item,
})

export const restPins = (story: Story): Pin[] => story.chapters.filter(placed).map(pinOf)

export const shownPins = (story: Story, view: PinView): Pin[] =>
  restPins(story).filter((p) => (!view.inPlay || p.frame <= view.frame) && p.id !== view.item)

const bboxPolygon = ([west, south, east, north]: BBox): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, north],
      [west, south],
      [east, south],
      [east, north],
      [west, north],
    ],
  ],
})

function geometryBBox(geometry: Polygon | LineString): BBox {
  const points = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates
  const lons = points.map(([lon = 0]) => lon)
  const lats = points.map(([, lat = 0]) => lat)
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

function outlineGeometry(item: StoryItem, data: Pick<PlaceData, 'footprints'>) {
  if (item.kind !== 'heat') return bboxPolygon(item.bbox)
  const osm = item.heat.object.osm
  return (
    data.footprints?.features.find((f) => f.properties.osm === osm)?.geometry ??
    bboxPolygon(item.bbox)
  )
}

export function focusOf(item: StoryItem, data: Pick<PlaceData, 'footprints'>): Focus {
  if (!placed(item)) return { outline: null, tag: null }
  const geometry = outlineGeometry(item, data)
  const [west, , east, north] = geometryBBox(geometry)
  return {
    outline: { type: 'Feature', geometry, properties: { colour: KIND_STYLE[item.kind].colour } },
    tag: [(west + east) / 2, north],
  }
}

function kmToBBox(point: LonLat, [west, south, east, north]: BBox): number {
  const [lon, lat] = point
  const nearest: LonLat = [
    Math.min(east, Math.max(west, lon)),
    Math.min(north, Math.max(south, lat)),
  ]
  return distanceKm(point, nearest)
}

function nearestCard(story: Story, point: LonLat): StoryItem | null {
  let best: { readonly item: StoryItem; readonly km: number; readonly centreKm: number } | null =
    null
  for (const item of [...story.chapters, ...story.secondary].filter(pinned)) {
    const km = kmToBBox(point, item.bbox)
    if (km > QUIET_RADIUS_KM) continue
    const centreKm = distanceKm(point, item.lonLat)
    if (best === null || km < best.km || (km === best.km && centreKm < best.centreKm)) {
      best = { item, km, centreKm }
    }
  }
  return best?.item ?? null
}

function detectionNear(
  data: Pick<PlaceData, 'events' | 'insar'>,
  corners: Corners,
  point: LonLat,
): boolean {
  const events = (data.events?.events ?? []).filter((e) => {
    const box = bboxRect(corners, e.bbox)
    return box.w * box.h < SCENE_WIDE_SHARE
  })
  const signals = (data.insar?.activity_events ?? []).filter((a) => !a.weather_suspect)
  return (
    events.some((e) => kmToBBox(point, e.bbox) <= QUIET_RADIUS_KM) ||
    signals.some((a) => kmToBBox(point, squareBBox([a.lon, a.lat], a.area_m2)) <= QUIET_RADIUS_KM)
  )
}

export function clickTarget(
  story: Story,
  data: Pick<PlaceData, 'radar' | 'events' | 'insar'>,
  point: LonLat,
): ClickTarget {
  const corners = data.radar?.corners_lonlat
  if (corners === undefined) return { kind: 'none' }
  if (!insideWatched(corners, point)) return { kind: 'fog' }
  const item = nearestCard(story, point)
  if (item !== null) return { kind: 'item', id: item.id }
  if (data.events === null && data.insar === null) return { kind: 'unanalysed' }
  return detectionNear(data, corners, point) ? { kind: 'none' } : { kind: 'quiet' }
}
