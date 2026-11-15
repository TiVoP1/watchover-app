import { HOOK, PLACES } from '#web/film/config.ts'
import { largestValidRect, type Rect } from '#web/film/crop.ts'
import { FRAME } from '#web/film/frame.ts'
import type { BBox, LonLat } from '#web/film/geo.ts'

const FILM = '/film'
const DATA = '/data'

export type RasterName =
  | 'night-world'
  | 'night-europe'
  | 'night-poland'
  | 'clouds-world'
  | 'clouds-europe'
  | 'clouds-wide'
  | 'clouds-detail'
  | 'strip-wide'
  | 'strip-core'

const RASTERS: readonly RasterName[] = [
  'night-world',
  'night-europe',
  'night-poland',
  'clouds-world',
  'clouds-europe',
  'clouds-wide',
  'clouds-detail',
  'strip-wide',
  'strip-core',
]

export interface Raster {
  readonly image: HTMLImageElement
  readonly bbox: BBox
}

export interface Pass {
  readonly scene: string
  readonly start: string
  readonly stop: string
  readonly direction: 'ASCENDING' | 'DESCENDING'
  readonly footprint: readonly LonLat[]
}

export interface Orbit {
  readonly startMs: number
  readonly stepS: number
  readonly repeatDays: number
  readonly track: Float32Array
  readonly coverage: HTMLImageElement
}

export interface PlaceFrame {
  readonly slug: string
  readonly name: string
  readonly time: string
  readonly image: HTMLImageElement
  readonly cropPx: Rect
}

/** Centreline and both edges run in flight order; alongKm and edgeUpTo depend on it. */
export interface Strip {
  readonly track: number
  readonly day: string
  readonly frames: readonly number[]
  readonly centreline: readonly [LonLat, LonLat]
  readonly leftEdge: readonly LonLat[]
  readonly rightEdge: readonly LonLat[]
}

export interface HallMotion {
  readonly mmPerC: number
  readonly mmPerCErr: number
  readonly rangeC: number
  readonly rangeFrom: string
  readonly rangeTo: string
}

export interface FilmAssets {
  readonly rasters: Readonly<Record<RasterName, Raster>>
  readonly window: {
    readonly image: HTMLImageElement
    readonly corners: readonly LonLat[]
    readonly looks: number
  }
  readonly pass: Pass
  readonly strip: Strip
  readonly hall: readonly LonLat[]
  readonly hallMotion: HallMotion
  readonly orbit: Orbit
  readonly places: readonly (PlaceFrame | { readonly slug: string; readonly missing: true })[]
}

type Json = Record<string, unknown>

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function field(obj: unknown, key: string, where: string): unknown {
  if (!isRecord(obj) || !(key in obj)) throw new Error(`${where}: missing "${key}"`)
  return obj[key]
}

function text(obj: unknown, key: string, where: string): string {
  const v = field(obj, key, where)
  if (typeof v !== 'string') throw new Error(`${where}: "${key}" is not a string`)
  return v
}

function num(obj: unknown, key: string, where: string): number {
  const v = field(obj, key, where)
  if (typeof v !== 'number' || !Number.isFinite(v))
    throw new Error(`${where}: "${key}" is not a number`)
  return v
}

const isText = (v: unknown): v is string => typeof v === 'string'

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function listOf<T>(obj: unknown, key: string, where: string, is: (v: unknown) => v is T): T[] {
  const v = field(obj, key, where)
  const list = Array.isArray(v) ? v.filter(is) : []
  if (!Array.isArray(v) || list.length !== v.length || list.length === 0)
    throw new Error(`${where}: "${key}" is not a list of the expected values`)
  return list
}

function lonLat(v: unknown, where: string): LonLat {
  if (!Array.isArray(v) || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
    throw new Error(`${where}: expected [lon, lat]`)
  }
  return [v[0], v[1]]
}

function ring(v: unknown, where: string, minPoints: number): LonLat[] {
  if (!Array.isArray(v) || v.length < minPoints)
    throw new Error(`${where}: expected ${minPoints}+ points`)
  return v.map((p: unknown) => lonLat(p, where))
}

function bbox(v: unknown, where: string): BBox {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((x) => typeof x === 'number')) {
    throw new Error(`${where}: expected a bbox [west, south, east, north]`)
  }
  const [w, s, e, n] = v.map(Number)
  return [w ?? 0, s ?? 0, e ?? 0, n ?? 0]
}

async function json(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return (await response.json()) as unknown
}

async function optionalJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) return null
  const type = response.headers.get('content-type') ?? ''
  return type.includes('json') ? ((await response.json()) as unknown) : null
}

export async function image(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'sync'
  img.src = url
  await img.decode().catch(() => {
    throw new Error(`${url}: image failed to load`)
  })
  return img
}

async function binary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.arrayBuffer()
}

async function rasters(manifest: unknown): Promise<Record<RasterName, Raster>> {
  const layers = field(manifest, 'layers', 'manifest.json')
  const loaded = await Promise.all(
    RASTERS.map(async (name) => {
      const where = `manifest.json layers ${name}`
      const layer = field(layers, name, 'manifest.json layers')
      const img = await image(`${FILM}/${text(layer, 'file', where)}`)
      return [name, { image: img, bbox: bbox(field(layer, 'bbox', where), where) }] as const
    }),
  )
  return Object.fromEntries(loaded) as Record<RasterName, Raster>
}

export function findPass(catalog: unknown, scene: string): Pass {
  const granules = field(catalog, 'granules', 'catalog.json')
  if (!Array.isArray(granules)) throw new Error('catalog.json: granules is not a list')
  const granule: unknown = granules.find((g: unknown) => isRecord(g) && g.scene === scene)
  if (granule === undefined) throw new Error(`catalog.json: no granule ${scene}`)
  const where = `catalog.json ${scene}`
  const direction = text(granule, 'direction', where)
  if (direction !== 'ASCENDING' && direction !== 'DESCENDING')
    throw new Error(`${where}: bad direction`)
  const coordinates = field(field(granule, 'footprint', where), 'coordinates', where)
  if (!Array.isArray(coordinates)) throw new Error(`${where}: footprint has no coordinates`)
  return {
    scene,
    start: text(granule, 'start', where),
    stop: text(granule, 'stop', where),
    direction,
    footprint: ring(coordinates[0], where, 4).slice(0, 4),
  }
}

function trackKey(objects: unknown, track: number): string {
  const tracks = field(objects, 'tracks', 'objects.json')
  if (!isRecord(tracks)) throw new Error('objects.json: tracks is not an object')
  const key = Object.keys(tracks).find(
    (k) => num(tracks[k], 'track', `objects.json tracks ${k}`) === track,
  )
  if (key === undefined) throw new Error(`objects.json: no track ${String(track)}`)
  return key
}

function temperatureRange(objects: unknown, key: string) {
  const where = `objects.json tracks ${key}`
  const entry = field(field(objects, 'tracks', 'objects.json'), key, 'objects.json tracks')
  const passes = listOf(entry, 'passes', where, isText)
  const temperatures = listOf(entry, 'temperature_c', where, isNumber)
  if (passes.length !== temperatures.length)
    throw new Error(`${where}: "passes" and "temperature_c" differ in length`)
  const warmC = Math.max(...temperatures)
  const coldC = Math.min(...temperatures)
  const warmPass = passes[temperatures.indexOf(warmC)]
  const coldPass = passes[temperatures.indexOf(coldC)]
  if (warmPass === undefined || coldPass === undefined) throw new Error(`${where}: no passes`)
  const warmFirst = Date.parse(warmPass) <= Date.parse(coldPass)
  return {
    rangeC: warmC - coldC,
    rangeFrom: warmFirst ? warmPass : coldPass,
    rangeTo: warmFirst ? coldPass : warmPass,
  }
}

export function parseHallMotion(objects: unknown, osm: string, track: number): HallMotion {
  const list = field(objects, 'objects', 'objects.json')
  if (!Array.isArray(list)) throw new Error('objects.json: objects is not a list')
  const hall: unknown = list.find((o: unknown) => isRecord(o) && o.osm === osm)
  if (hall === undefined) throw new Error(`objects.json: no object ${osm}`)
  const key = trackKey(objects, track)
  const fit = field(field(hall, 'tracks', `objects.json ${osm}`), key, `objects.json ${osm} tracks`)
  const where = `objects.json ${osm} tracks ${key}`
  return {
    mmPerC: num(fit, 'mm_per_c', where),
    mmPerCErr: num(fit, 'mm_per_c_err', where),
    ...temperatureRange(objects, key),
  }
}

async function radarWindow(): Promise<FilmAssets['window']> {
  const meta = await json(`${DATA}/${HOOK.slug}/radar.json`)
  const steps = field(field(meta, 'sharpen', 'radar.json'), 'steps', 'radar.json sharpen')
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('radar.json: no Sharpen steps')
  const step = 'radar.json sharpen step'
  const deepest: unknown = steps.reduce((best: unknown, next: unknown) =>
    num(next, 'looks', step) > num(best, 'looks', step) ? next : best,
  )
  return {
    image: await image(`${DATA}/${HOOK.slug}/${text(deepest, 'frame', step)}`),
    corners: ring(field(meta, 'corners_lonlat', 'radar.json'), 'radar.json corners', 4).slice(0, 4),
    looks: num(deepest, 'looks', step),
  }
}

async function orbit(manifest: unknown): Promise<Orbit> {
  const meta = await json(`${FILM}/${text(manifest, 'orbit', 'manifest.json')}`)
  const samples = num(meta, 'samples', 'orbit.json')
  const buffer = await binary(`${FILM}/${text(meta, 'track_file', 'orbit.json')}`)
  if (buffer.byteLength !== samples * 8)
    throw new Error('orbit-track.bin: size does not match orbit.json')
  return {
    startMs: Date.parse(text(meta, 'start', 'orbit.json')),
    stepS: num(meta, 'step_s', 'orbit.json'),
    repeatDays: num(meta, 'repeat_days', 'orbit.json'),
    track: new Float32Array(buffer),
    coverage: await image(`${FILM}/${text(meta, 'coverage_file', 'orbit.json')}`),
  }
}

async function place(slug: string, name: string | null): Promise<FilmAssets['places'][number]> {
  const meta = await optionalJson(`${DATA}/${slug}/radar.json`)
  const frames = isRecord(meta) ? meta.frames : null
  if (!Array.isArray(frames) || frames.length === 0) return { slug, missing: true }
  const last: unknown = frames[frames.length - 1]
  const catalog = name === null ? await optionalJson(`${DATA}/${slug}/catalog.json`) : null
  const catalogName = isRecord(catalog) && isRecord(catalog.place) ? catalog.place.name : null
  const img = await image(`${DATA}/${slug}/${text(last, 'false_colour', `${slug} radar.json`)}`)
  return {
    slug,
    name: name ?? (typeof catalogName === 'string' ? catalogName : slug),
    time: text(last, 'time', `${slug} radar.json`),
    image: img,
    cropPx: dataCrop(img),
  }
}

const MASK_WIDTH_PX = 256
const MASK_ALPHA_MIN = 250

function dataCrop(img: HTMLImageElement): Rect {
  const w = MASK_WIDTH_PX
  const h = Math.max(1, Math.round((MASK_WIDTH_PX * img.naturalHeight) / img.naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d', { willReadFrequently: true })
  const whole: Rect = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
  if (g === null) return whole
  g.drawImage(img, 0, 0, w, h)
  const pixels = g.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = (pixels[i * 4 + 3] ?? 0) > MASK_ALPHA_MIN ? 1 : 0
  const rect = largestValidRect(mask, w, h, FRAME.width / FRAME.height)
  if (rect === null) return whole
  const k = img.naturalWidth / w
  return { x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k }
}

export function placeList(search: string): readonly { slug: string; name: string | null }[] {
  const override = new URLSearchParams(search).get('places')
  if (override === null) return PLACES
  return override
    .split(',')
    .filter((slug) => slug.length > 0)
    .map((slug) => ({ slug, name: PLACES.find((p) => p.slug === slug)?.name ?? null }))
}

export function parseStrip(manifest: unknown): Strip {
  const meta = field(manifest, 'strip', 'manifest.json')
  const where = 'manifest.json strip'
  const frames = field(meta, 'frames', where)
  if (!Array.isArray(frames) || frames.length === 0) throw new Error(`${where}: no frames`)
  const centreline = ring(field(meta, 'centreline', where), `${where} centreline`, 2)
  const [first, last] = [centreline[0], centreline[centreline.length - 1]]
  if (first === undefined || last === undefined)
    throw new Error(`${where}: centreline needs two points`)
  return {
    track: num(meta, 'track', where),
    day: text(meta, 'day', where),
    frames: frames.map((f: unknown) => num(f, 'frame', `${where} frame`)),
    centreline: [first, last],
    leftEdge: ring(field(meta, 'left_edge', where), `${where} left edge`, 2),
    rightEdge: ring(field(meta, 'right_edge', where), `${where} right edge`, 2),
  }
}

export async function loadFilmAssets(search: string): Promise<FilmAssets> {
  const manifest = await json(`${FILM}/manifest.json`)
  const passScene = text(field(manifest, 'pass', 'manifest.json'), 'scene', 'manifest.json pass')
  const hallFile = text(manifest, 'hall', 'manifest.json')
  const [loadedRasters, catalog, window, hallJson, objects, loadedOrbit, places] =
    await Promise.all([
      rasters(manifest),
      json(`${DATA}/${HOOK.slug}/catalog.json`),
      radarWindow(),
      json(`${FILM}/${hallFile}`),
      json(`${DATA}/${HOOK.slug}/insar/objects.json`),
      orbit(manifest),
      Promise.all(placeList(search).map((p) => place(p.slug, p.name))),
    ])
  return {
    rasters: loadedRasters,
    window,
    pass: findPass(catalog, passScene),
    strip: parseStrip(manifest),
    hall: ring(field(hallJson, 'ring', hallFile), hallFile, 4),
    hallMotion: parseHallMotion(objects, `way/${String(HOOK.osmWay)}`, HOOK.duskTrack),
    orbit: loadedOrbit,
    places,
  }
}
