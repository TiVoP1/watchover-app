import {
  addProtocol,
  setWorkerUrl,
  type ExpressionSpecification,
  type FontFacesSpecification,
  type LayerSpecification,
  type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import {
  covers,
  parseCoverage,
  REMOTE_STYLE_URL,
  shownLayer,
  TILE_PROTOCOL,
  type TileRange,
} from '#web/map/basemap-extract.ts'
import { fromNight, NIGHT_ZOOM, ORBIT_STYLE } from '#web/map/orbit.ts'
import { COLOR, TEXT_PX } from '#web/tokens.ts'

setWorkerUrl(workerUrl)

const LOCAL_STYLE_URL = '/basemap/style.json'
const LOCAL_TILES_URL = '/basemap/tiles/'
const BASEMAP_TIMEOUT_MS = 4000

export const LABEL_FONT = 'Fira Sans Condensed Medium'
export const LABEL_HALO_WIDTH_PX = 2

const LABEL_FONT_FACES: FontFacesSpecification = {
  [LABEL_FONT]: [
    {
      url: '/fonts/fira-sans-condensed-500-latin.woff2',
      'unicode-range': [
        'U+0000-00FF',
        'U+0131',
        'U+0152-0153',
        'U+02BB-02BC',
        'U+02C6',
        'U+02DA',
        'U+02DC',
        'U+2000-206F',
        'U+20AC',
        'U+2122',
        'U+2191',
        'U+2193',
        'U+2212',
        'U+2215',
        'U+FEFF',
        'U+FFFD',
      ],
    },
    {
      url: '/fonts/fira-sans-condensed-500-latin-ext.woff2',
      'unicode-range': [
        'U+0100-02BA',
        'U+02BD-02C5',
        'U+02C7-02CC',
        'U+02CE-02D7',
        'U+02DD-02FF',
        'U+1E00-1E9F',
        'U+20A0-20AB',
        'U+20AD-20C4',
        'U+2C60-2C7F',
        'U+A720-A7FF',
      ],
    },
  ],
}

const LATIN_NAME: ExpressionSpecification = [
  'case',
  ['has', 'name:nonlatin'],
  ['get', 'name:latin'],
  ['coalesce', ['get', 'name_en'], ['get', 'name']],
]

function recolour(layer: LayerSpecification): LayerSpecification | null {
  if (!shownLayer(layer)) return null
  if (layer.type === 'background') {
    return { ...layer, paint: { 'background-color': fromNight(COLOR.mapLand) } }
  }
  if (layer.type === 'fill' && /water/.test(layer.id)) {
    return { ...layer, paint: { 'fill-color': fromNight(COLOR.mapWater) } }
  }
  if (layer.type === 'line' && /waterway/.test(layer.id)) {
    return { ...layer, paint: { ...layer.paint, 'line-color': COLOR.mapWater } }
  }
  if (layer.type === 'line' && /(highway|road|railway|tunnel|bridge)/.test(layer.id)) {
    return { ...layer, paint: { ...layer.paint, 'line-color': COLOR.mapRoad } }
  }
  if (layer.type === 'line' && /boundary/.test(layer.id)) {
    return { ...layer, paint: { ...layer.paint, 'line-color': COLOR.line } }
  }
  if (layer.type === 'symbol') {
    return {
      ...layer,
      minzoom: Math.max(layer.minzoom ?? 0, NIGHT_ZOOM[1]),
      layout: { 'text-field': LATIN_NAME, 'text-font': [LABEL_FONT], 'text-size': TEXT_PX.body },
      paint: {
        'text-color': COLOR.mapLabel,
        'text-halo-color': COLOR.bg,
        'text-halo-width': LABEL_HALO_WIDTH_PX,
      },
    }
  }
  return layer
}

const OFFLINE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': fromNight(COLOR.mapLand) },
    },
  ],
  'font-faces': LABEL_FONT_FACES,
  ...ORBIT_STYLE,
}

async function fetchFile(url: string, signal: AbortSignal): Promise<Response | null> {
  const response = await fetch(url, { signal })
  const html = response.headers.get('content-type')?.includes('text/html') ?? false
  return response.ok && !html ? response : null
}

async function fetchStyle(url: string): Promise<StyleSpecification | null> {
  try {
    const response = await fetchFile(url, AbortSignal.timeout(BASEMAP_TIMEOUT_MS))
    return response === null ? null : ((await response.json()) as StyleSpecification)
  } catch {
    return null
  }
}

const tileUrl = (tile: string): string => `${LOCAL_TILES_URL}${tile}.pbf`

async function extractServed([z, x, y]: TileRange): Promise<boolean> {
  try {
    const signal = AbortSignal.timeout(BASEMAP_TIMEOUT_MS)
    return (await fetchFile(tileUrl(`${z}/${x}/${y}`), signal)) !== null
  } catch {
    return false
  }
}

function serveLocalTiles(ranges: readonly TileRange[]): void {
  const prefix = `${TILE_PROTOCOL}://`
  addProtocol(TILE_PROTOCOL, async ({ url }, abort) => {
    const tile = url.slice(prefix.length)
    if (!covers(ranges, tile)) return { data: new ArrayBuffer(0) }
    const response = await fetchFile(tileUrl(tile), abort.signal)
    if (response === null) throw new Error(`${tileUrl(tile)} is missing from the basemap extract`)
    return { data: await response.arrayBuffer() }
  })
}

async function sourceStyle(): Promise<StyleSpecification | null> {
  const local = await fetchStyle(LOCAL_STYLE_URL)
  const ranges = local === null ? null : parseCoverage(local.metadata)
  const first = ranges?.[0]
  if (local !== null && ranges !== null && first !== undefined && (await extractServed(first))) {
    serveLocalTiles(ranges)
    return local
  }
  return fetchStyle(REMOTE_STYLE_URL)
}

export async function loadBasemap(): Promise<StyleSpecification> {
  const style = await sourceStyle()
  if (style === null) return OFFLINE
  const layers = style.layers.map(recolour).filter((l): l is LayerSpecification => l !== null)
  return { ...style, layers, 'font-faces': LABEL_FONT_FACES, ...ORBIT_STYLE }
}

export const firstLabelLayer = (style: StyleSpecification): string | undefined =>
  style.layers.find((l) => l.type === 'symbol')?.id
