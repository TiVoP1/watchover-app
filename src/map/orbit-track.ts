import type { MultiLineString, Polygon, Position } from 'geojson'
import { angle, fromLonLat, slerp, toLonLat, type LonLat } from '#web/film/geo.ts'

export const SATELLITE_SPEEDUP = 60

const ORBIT_DIR = '/film'
const ORBIT_URL = `${ORBIT_DIR}/orbit.json`
const DAY_MS = 86_400_000
const BYTES_PER_SAMPLE = 8
const ENTRY_LEAD_MS = 12 * 60_000
const ENTRY_AWAY_MIN_DEG = 20
const ENTRY_AWAY_MAX_DEG = 28
const SCAN_MAX_SAMPLES = 600

export type Flank = 'west' | 'east'

export interface OrbitTrack {
  readonly startMs: number
  readonly stepMs: number
  readonly cycle: number
  readonly lonLat: Float32Array
}

export interface Revolution {
  readonly from: number
  readonly to: number
  readonly flank: Flank
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseOrbitTrack(meta: unknown, buffer: ArrayBuffer): OrbitTrack {
  if (!isRecord(meta)) throw new Error('orbit.json: not an object')
  const { start, step_s: stepS, samples, repeat_days: repeatDays } = meta
  const startMs = typeof start === 'string' ? Date.parse(start) : Number.NaN
  if (Number.isNaN(startMs)) throw new Error('orbit.json: bad "start"')
  if (typeof stepS !== 'number' || stepS <= 0) throw new Error('orbit.json: bad "step_s"')
  if (typeof samples !== 'number' || !Number.isInteger(samples) || samples < 2) {
    throw new Error('orbit.json: bad "samples"')
  }
  if (typeof repeatDays !== 'number') throw new Error('orbit.json: bad "repeat_days"')
  if (buffer.byteLength !== samples * BYTES_PER_SAMPLE) {
    throw new Error('orbit-track.bin: size does not match orbit.json')
  }
  const stepMs = stepS * 1000
  const cycle = samples - 1
  if (Math.abs(cycle * stepMs - repeatDays * DAY_MS) >= stepMs) {
    throw new Error('orbit.json: the track does not span one repeat cycle')
  }
  return { startMs, stepMs, cycle, lonLat: new Float32Array(buffer) }
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response
}

async function fetchTrack(): Promise<OrbitTrack> {
  const meta = (await (await fetchOk(ORBIT_URL)).json()) as unknown
  const file = isRecord(meta) ? meta.track_file : undefined
  if (typeof file !== 'string') throw new Error('orbit.json: bad "track_file"')
  return parseOrbitTrack(meta, await (await fetchOk(`${ORBIT_DIR}/${file}`)).arrayBuffer())
}

let loading: Promise<OrbitTrack> | null = null

export function loadOrbitTrack(): Promise<OrbitTrack> {
  loading ??= fetchTrack().catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

const wrap = (k: number, n: number): number => ((k % n) + n) % n

const signedDeg = (deg: number): number => deg - 360 * Math.round(deg / 360)

const eastOf = (place: LonLat, lon: number): number => signedDeg(lon - place[0])

const flankOf = (place: LonLat, lon: number): Flank => (eastOf(place, lon) > 0 ? 'east' : 'west')

export function swathFlank(footprint: Polygon, place: LonLat): Flank {
  const ring = footprint.coordinates[0]?.slice(1) ?? []
  const east = ring.reduce((sum, [lon = place[0]]) => sum + eastOf(place, lon), 0)
  return east > 0 ? 'east' : 'west'
}

export function sampleAt(track: OrbitTrack, k: number): LonLat {
  const i = wrap(Math.floor(k), track.cycle)
  return [track.lonLat[2 * i] ?? 0, track.lonLat[2 * i + 1] ?? 0]
}

export function groundPoint(track: OrbitTrack, index: number): LonLat {
  const k = Math.floor(index)
  const from = fromLonLat(sampleAt(track, k))
  return toLonLat(slerp(from, fromLonLat(sampleAt(track, k + 1)), index - k))
}

export const indexAt = (track: OrbitTrack, timeMs: number): number =>
  (timeMs - track.startMs) / track.stepMs

export const playIndex = (track: OrbitTrack, entry: number, elapsedMs: number): number =>
  entry + (SATELLITE_SPEEDUP * elapsedMs - ENTRY_LEAD_MS) / track.stepMs

function distances(track: OrbitTrack, place: LonLat): (k: number) => number {
  const centre = fromLonLat(place)
  return (k) => angle(fromLonLat(sampleAt(track, k)), centre)
}

function closestIndex(track: OrbitTrack, place: LonLat, from: number, to: number): number {
  const distance = distances(track, place)
  let closest = from
  for (let k = from + 1; k <= to; k++) if (distance(k) < distance(closest)) closest = k
  return closest
}

export function entryIndex(track: OrbitTrack, place: LonLat, flank: Flank): number {
  const lat = place[1]
  const outward = flank === 'east' ? 1 : -1
  let nearest: { readonly index: number; readonly missDeg: number } | null = null
  for (let k = 0; k < track.cycle; k++) {
    const [lon0, lat0] = sampleAt(track, k)
    const [lon1, lat1] = sampleAt(track, k + 1)
    if (lat0 >= lat || lat1 < lat) continue
    const f = (lat - lat0) / (lat1 - lat0)
    const away = outward * eastOf(place, lon0 + signedDeg(lon1 - lon0) * f)
    const missDeg = Math.max(ENTRY_AWAY_MIN_DEG - away, away - ENTRY_AWAY_MAX_DEG, 0)
    if (missDeg === 0) return k + f
    if (nearest === null || missDeg < nearest.missDeg) nearest = { index: k + f, missDeg }
  }
  return nearest?.index ?? closestIndex(track, place, 0, track.cycle - 1)
}

export function revolutionAt(track: OrbitTrack, index: number, place: LonLat): Revolution {
  const distance = distances(track, place)
  const farthest = (k: number) => distance(k) >= distance(k - 1) && distance(k) > distance(k + 1)
  const k = Math.floor(index)
  let from = k
  while (!farthest(from) && k - from < SCAN_MAX_SAMPLES) from--
  let to = k + 1
  while (!farthest(to) && to - k < SCAN_MAX_SAMPLES) to++
  const [lon] = sampleAt(track, closestIndex(track, place, from, to))
  return { from, to, flank: flankOf(place, lon) }
}

export function trackLine(track: OrbitTrack, revolution: Revolution): MultiLineString {
  let line: Position[] = []
  const lines = [line]
  let previous: LonLat | null = null
  for (let k = revolution.from; k <= revolution.to; k++) {
    const point = sampleAt(track, k)
    if (previous !== null && Math.abs(point[0] - previous[0]) > 180) {
      const edge = previous[0] > 0 ? 180 : -180
      const f = (edge - previous[0]) / (point[0] + 2 * edge - previous[0])
      const lat = previous[1] + (point[1] - previous[1]) * f
      line.push([edge, lat])
      line = [[-edge, lat]]
      lines.push(line)
    }
    line.push([point[0], point[1]])
    previous = point
  }
  return { type: 'MultiLineString', coordinates: lines }
}
