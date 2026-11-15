import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { TextDecoder } from 'node:util'
import {
  COVERAGE_KEY,
  REMOTE_STYLE_URL,
  TILE_PROTOCOL,
  shownLayer,
  tileRange,
  tileX,
  tileY,
} from '#web/map/basemap-extract.ts'
import { stripTile } from '#web/map/tile-strip.ts'
import { PLACES } from '#web/places.ts'

const SOURCE_ID = 'openmaptiles'
const EXTRACT_KEY = 'watchover:extract'
const USER_AGENT = 'offline-basemap-extract/1.0'
const REQUEST_TIMEOUT_MS = 30_000
const RETRIES = 4
const RETRY_BASE_MS = 1_000
const CONCURRENCY = 4
const PROGRESS_EVERY_TILES = 250

const WORLD_BBOX_DEG = [-180, -90, 180, 90]
const WORLD_MAX_ZOOM = 4
const EUROPE_BBOX_DEG = [-25, 34, 45, 72]
const EUROPE_ZOOM = 5
const PLACE_MIN_ZOOM = 5
const PLACE_MAX_ZOOM = 12
const PLACE_BOX_KM = 120
const DETAIL_ZOOM = 13
const DETAIL_BOX_KM = 40
const VIEW_RADIUS_TILES = 2
const KM_PER_DEG_LAT = 111.32

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const outDir = join(publicDir, 'basemap')
const tilesDir = join(outDir, 'tiles')
const styleFile = join(outDir, 'style.json')
const text = new TextDecoder()

const retryable = (status) => status === 429 || status >= 500

async function fetchBytes(url) {
  for (let attempt = 0; ; attempt++) {
    let status = null
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.ok) return new Uint8Array(await response.arrayBuffer())
      status = response.status
      await response.body?.cancel()
    } catch (error) {
      if (attempt >= RETRIES) throw error
    }
    if (status !== null && (attempt >= RETRIES || !retryable(status))) {
      throw new Error(`${url}: HTTP ${status}`)
    }
    await sleep(RETRY_BASE_MS * 2 ** attempt)
  }
}

const fetchJson = async (url) => JSON.parse(text.decode(await fetchBytes(url)))

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function optionalJson(path) {
  try {
    return await readJson(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(`${path}.tmp`, data)
  await rename(`${path}.tmp`, path)
}

function boxKm(lonDeg, latDeg, km) {
  const halfLatDeg = km / 2 / KM_PER_DEG_LAT
  const halfLonDeg = halfLatDeg / Math.cos((latDeg * Math.PI) / 180)
  return [lonDeg - halfLonDeg, latDeg - halfLatDeg, lonDeg + halfLonDeg, latDeg + halfLatDeg]
}

function cornersBox(corners) {
  const lons = corners.map(([lon]) => lon)
  const lats = corners.map(([, lat]) => lat)
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

const union = (a, b) => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
]

function aroundTile([z, x0, y0, x1, y1], cx, cy) {
  const last = 2 ** z - 1
  return [
    z,
    Math.max(0, Math.min(x0, cx - VIEW_RADIUS_TILES)),
    Math.max(0, Math.min(y0, cy - VIEW_RADIUS_TILES)),
    Math.min(last, Math.max(x1, cx + VIEW_RADIUS_TILES)),
    Math.min(last, Math.max(y1, cy + VIEW_RADIUS_TILES)),
  ]
}

async function placeRanges(slug) {
  const { place } = await readJson(join(publicDir, 'data', slug, 'catalog.json'))
  const radar = await optionalJson(join(publicDir, 'data', slug, 'radar.json'))
  const withRadar = (box) => (radar ? union(box, cornersBox(radar.corners_lonlat)) : box)
  const area = withRadar(boxKm(place.lon, place.lat, PLACE_BOX_KM))
  const ranges = []
  for (let z = PLACE_MIN_ZOOM; z <= PLACE_MAX_ZOOM; z++) {
    ranges.push(aroundTile(tileRange(z, area), tileX(place.lon, z), tileY(place.lat, z)))
  }
  ranges.push(tileRange(DETAIL_ZOOM, withRadar(boxKm(place.lon, place.lat, DETAIL_BOX_KM))))
  return ranges
}

function tilesOf(ranges) {
  const tiles = new Set()
  for (const [z, x0, y0, x1, y1] of ranges) {
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) tiles.add(`${z}/${x}/${y}`)
    }
  }
  return [...tiles]
}

async function prune(keep) {
  const entries = await readdir(tilesDir, { recursive: true, withFileTypes: true }).catch(
    (error) => (error.code === 'ENOENT' ? [] : Promise.reject(error)),
  )
  let removed = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name)
    if (keep.has(relative(tilesDir, path).split(sep).join('/'))) continue
    await rm(path)
    removed++
  }
  return removed
}

async function download(tiles, template, sourceLayers) {
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < tiles.length) {
      const tile = tiles[next++]
      const [z, x, y] = tile.split('/')
      const url = template.replace('{z}', z).replace('{x}', x).replace('{y}', y)
      const data = stripTile(await fetchBytes(url), sourceLayers)
      await writeAtomic(join(tilesDir, `${tile}.pbf`), data)
      done++
      if (done % PROGRESS_EVERY_TILES === 0) process.stdout.write(`${done}/${tiles.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

async function sizeOf(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const files = entries.filter((e) => e.isFile())
  const sizes = await Promise.all(files.map((e) => stat(join(e.parentPath, e.name))))
  return sizes.reduce((sum, s) => sum + s.size, 0)
}

const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  )

const style = await fetchJson(REMOTE_STYLE_URL)
const tilejson = await fetchJson(style.sources[SOURCE_ID].url)
const layers = style.layers.filter(shownLayer)
const foreign = layers.filter((l) => 'source' in l && l.source !== SOURCE_ID)
if (foreign.length > 0) throw new Error(`layers on other sources: ${foreign.map((l) => l.id)}`)
const sourceLayers = new Set(layers.map((l) => l['source-layer']).filter(Boolean))
const extract = { tiles: tilejson.tiles[0], layers: [...sourceLayers].sort() }

const ranges = [
  ...Array.from({ length: WORLD_MAX_ZOOM + 1 }, (_, z) => tileRange(z, WORLD_BBOX_DEG)),
  tileRange(EUROPE_ZOOM, EUROPE_BBOX_DEG),
  ...(await Promise.all(PLACES.map((p) => placeRanges(p.slug)))).flat(),
]
const tiles = tilesOf(ranges)

const previous = await optionalJson(styleFile)
const stale =
  previous !== null && JSON.stringify(previous.metadata?.[EXTRACT_KEY]) !== JSON.stringify(extract)
const removed = await prune(stale ? new Set() : new Set(tiles.map((t) => `${t}.pbf`)))
const missing = []
for (const tile of tiles) {
  if (!(await exists(join(tilesDir, `${tile}.pbf`)))) missing.push(tile)
}
await download(missing, extract.tiles, sourceLayers)

const local = {
  version: style.version,
  metadata: { [COVERAGE_KEY]: ranges, [EXTRACT_KEY]: extract },
  sources: {
    [SOURCE_ID]: {
      type: 'vector',
      tiles: [`${TILE_PROTOCOL}://{z}/{x}/{y}`],
      minzoom: 0,
      maxzoom: DETAIL_ZOOM,
      attribution: tilejson.attribution,
    },
  },
  layers,
}
await writeAtomic(styleFile, `${JSON.stringify(local, null, 2)}\n`)

const totalMb = (await sizeOf(outDir)) / 1e6
process.stdout.write(
  `basemap: ${tiles.length} tiles (${missing.length} fetched, ${removed} removed), ` +
    `layers ${extract.layers.join(', ')}, ${totalMb.toFixed(1)} MB in public/basemap\n`,
)
