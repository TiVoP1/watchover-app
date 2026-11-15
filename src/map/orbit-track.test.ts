import type { Polygon } from 'geojson'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Catalog } from '#web/data/types.ts'
import { distanceKm, type LonLat } from '#web/film/geo.ts'
import {
  entryIndex,
  type Flank,
  groundPoint,
  indexAt,
  loadOrbitTrack,
  parseOrbitTrack,
  playIndex,
  revolutionAt,
  SATELLITE_SPEEDUP,
  sampleAt,
  swathFlank,
  trackLine,
} from '#web/map/orbit-track.ts'

const json = import.meta.glob<unknown>(
  ['/public/film/orbit.json', '/public/data/stalowa-wola/catalog.json'],
  { eager: true, import: 'default' },
)
const inline = import.meta.glob<string>('/public/film/orbit-track.bin', {
  query: '?url&inline',
  import: 'default',
  eager: true,
})

function bytes(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out.buffer
}

const meta = json['/public/film/orbit.json']
const catalog = json['/public/data/stalowa-wola/catalog.json'] as Catalog
const buffer = bytes(inline['/public/film/orbit-track.bin'] ?? '')
const track = parseOrbitTrack(meta, buffer)
const home: LonLat = [catalog.place.lon, catalog.place.lat]
const EARTH_QUARTER_KM = 10_007
const FLANKS: readonly Flank[] = ['west', 'east']

const eastOfHome = (lon: number) => lon - home[0]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('orbit track file', () => {
  it('holds one 12-day repeat cycle of 30 s samples that closes on itself', () => {
    expect(track.cycle).toBe(34_560)
    expect(track.stepMs).toBe(30_000)
    expect(track.startMs).toBe(Date.parse('2026-10-14T03:20:00Z'))
    const last: LonLat = [
      track.lonLat[2 * track.cycle] ?? 0,
      track.lonLat[2 * track.cycle + 1] ?? 0,
    ]
    expect(distanceKm(sampleAt(track, 0), last)).toBeLessThan(10)
  })

  it('rejects metadata the binary does not match', () => {
    expect(() => parseOrbitTrack(meta, new ArrayBuffer(16))).toThrow(/size/)
    expect(() => parseOrbitTrack(null, buffer)).toThrow(/not an object/)
    if (typeof meta !== 'object' || meta === null) throw new Error('orbit.json')
    expect(() => parseOrbitTrack({ ...meta, start: 'soon' }, buffer)).toThrow(/start/)
    expect(() => parseOrbitTrack({ ...meta, repeat_days: 11 }, buffer)).toThrow(/repeat cycle/)
  })
})

describe('ground track', () => {
  it('runs northbound about 700 km east of Stalowa Wola at its next track 28 look', () => {
    const look = catalog.schedule.upcoming.find((p) => p.track === 28)
    if (look === undefined) throw new Error('no track 28 look')
    const index = indexAt(track, Date.parse(look.time))
    const [lon, lat] = groundPoint(track, index)
    expect(Math.abs(lat - home[1])).toBeLessThan(2)
    expect(eastOfHome(lon)).toBeGreaterThan(4)
    expect(eastOfHome(lon)).toBeLessThan(12)
    expect(groundPoint(track, index + 1)[1]).toBeGreaterThan(lat)
  })

  it('interpolates on the sphere and wraps around the repeat cycle', () => {
    const k = 1234
    expect(groundPoint(track, k)[0]).toBeCloseTo(sampleAt(track, k)[0], 4)
    const step = distanceKm(sampleAt(track, k), sampleAt(track, k + 1))
    const middle = groundPoint(track, k + 0.5)
    expect(distanceKm(middle, sampleAt(track, k))).toBeCloseTo(step / 2, 0)
    expect(distanceKm(groundPoint(track, k - 2 * track.cycle), sampleAt(track, k))).toBeLessThan(
      0.01,
    )
    expect(sampleAt(track, -1)).toEqual(sampleAt(track, track.cycle - 1))
  })
})

describe('swath flank', () => {
  const square = (west: number, east: number): Polygon => ({
    type: 'Polygon',
    coordinates: [
      [
        [west, 49],
        [east, 49],
        [east, 52],
        [west, 52],
        [west, 49],
      ],
    ],
  })

  it('finds the side of the place the next swath lies on', () => {
    const next = catalog.schedule.tracks.find((t) => t.track === 28)
    if (next === undefined) throw new Error('no track 28 footprint')
    expect(swathFlank(next.footprint, home)).toBe('east')
    expect(swathFlank(square(19, 23), home)).toBe('west')
    expect(swathFlank(square(178, -176), [179, 50])).toBe('east')
  })
})

describe('satellite flight', () => {
  it.each(FLANKS)('crosses the latitude of the place northbound, 20 to 28 degrees %s', (flank) => {
    const entry = entryIndex(track, home, flank)
    const [lon, lat] = groundPoint(track, entry)
    const away = flank === 'east' ? eastOfHome(lon) : -eastOfHome(lon)
    expect(lat).toBeCloseTo(home[1], 2)
    expect(away).toBeGreaterThanOrEqual(20)
    expect(away).toBeLessThanOrEqual(28)
    expect(groundPoint(track, entry + 1)[1]).toBeGreaterThan(lat)
    expect(revolutionAt(track, entry, home).flank).toBe(flank)
  })

  it.each(FLANKS)('moves 60 times faster than real time, in front of the globe (%s)', (flank) => {
    const entry = entryIndex(track, home, flank)
    expect(SATELLITE_SPEEDUP).toBe(60)
    const start = playIndex(track, entry, 0)
    const later = playIndex(track, entry, 15_000)
    expect(later - start).toBeCloseTo(30, 9)
    expect(playIndex(track, entry, 12_000)).toBeCloseTo(entry, 9)
    expect(distanceKm(groundPoint(track, start), home)).toBeLessThan(0.7 * EARTH_QUARTER_KM)
    expect(distanceKm(groundPoint(track, later), home)).toBeLessThan(0.7 * EARTH_QUARTER_KM)
    expect(distanceKm(groundPoint(track, start), groundPoint(track, later))).toBeGreaterThan(5000)
  })

  it('falls back to the closest point for a place the orbit never crosses', () => {
    expect(groundPoint(track, entryIndex(track, [0, 89], 'east'))[1]).toBeGreaterThan(80)
  })
})

describe('revolution', () => {
  const entry = entryIndex(track, home, 'east')
  const revolution = revolutionAt(track, entry, home)

  it('spans one orbit between two points behind the globe', () => {
    expect(revolution.from).toBeLessThanOrEqual(entry)
    expect(revolution.to).toBeGreaterThan(entry)
    const minutes = ((revolution.to - revolution.from) * track.stepMs) / 60_000
    expect(minutes).toBeGreaterThan(95)
    expect(minutes).toBeLessThan(105)
    expect(distanceKm(sampleAt(track, revolution.from), home)).toBeGreaterThan(EARTH_QUARTER_KM)
    expect(distanceKm(sampleAt(track, revolution.to), home)).toBeGreaterThan(EARTH_QUARTER_KM)
    expect(revolutionAt(track, revolution.to, home).from).toBe(revolution.to)
  })

  it('splits the line where it crosses the antimeridian', () => {
    const lines = trackLine(track, revolution).coordinates
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        expect(Math.abs((line[i]?.[0] ?? 0) - (line[i - 1]?.[0] ?? 0))).toBeLessThan(60)
      }
    }
    const ends = lines.slice(1).map((line) => line[0]?.[0])
    expect(ends.every((lon) => lon === 180 || lon === -180)).toBe(true)
  })
})

describe('loading', () => {
  function serve(url: string): Promise<Response> {
    if (url === '/film/orbit.json') return Promise.resolve(Response.json(meta))
    if (url === '/film/orbit-track.bin') return Promise.resolve(new Response(buffer.slice(0)))
    return Promise.resolve(new Response(null, { status: 404 }))
  }

  it('loads the track once and tries again after a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    )
    await expect(loadOrbitTrack()).rejects.toThrow(/HTTP 404/)
    const fetchMock = vi.fn(serve)
    vi.stubGlobal('fetch', fetchMock)
    const first = loadOrbitTrack()
    expect((await first).cycle).toBe(track.cycle)
    expect(loadOrbitTrack()).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
