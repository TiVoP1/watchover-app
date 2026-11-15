export const REMOTE_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'
export const TILE_PROTOCOL = 'basemap'
export const COVERAGE_KEY = 'watchover:coverage'

export type TileRange = readonly [z: number, xMin: number, yMin: number, xMax: number, yMax: number]
export type BboxDeg = readonly [west: number, south: number, east: number, north: number]

const MERCATOR_MAX_LAT_DEG = 85.05113

const HIDDEN =
  /^(building|poi|aeroway|highway_name|road_oneway|road_area_pier|housenumber|landuse|landcover|park|place_village|place_other|place_suburb|place_state|place_country|water_name)/

export const shownLayer = (layer: { readonly id: string; readonly type: string }): boolean =>
  !HIDDEN.test(layer.id) && (layer.type !== 'symbol' || layer.id.startsWith('place_'))

export const tileX = (lonDeg: number, z: number): number =>
  Math.floor(((lonDeg + 180) / 360) * 2 ** z)

export function tileY(latDeg: number, z: number): number {
  const clampedDeg = Math.min(Math.max(latDeg, -MERCATOR_MAX_LAT_DEG), MERCATOR_MAX_LAT_DEG)
  const latRad = (clampedDeg * Math.PI) / 180
  return Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * 2 ** z)
}

export function tileRange(z: number, [west, south, east, north]: BboxDeg): TileRange {
  const clamp = (tile: number) => Math.min(Math.max(tile, 0), 2 ** z - 1)
  return [
    z,
    clamp(tileX(west, z)),
    clamp(tileY(north, z)),
    clamp(tileX(east, z)),
    clamp(tileY(south, z)),
  ]
}

export function covers(ranges: readonly TileRange[], tile: string): boolean {
  const [z = -1, x = -1, y = -1] = tile.split('/').map(Number)
  return ranges.some(([rz, x0, y0, x1, y1]) => rz === z && x >= x0 && x <= x1 && y >= y0 && y <= y1)
}

const isRange = (value: unknown): value is TileRange =>
  Array.isArray(value) && value.length === 5 && value.every((n) => Number.isInteger(n))

export function parseCoverage(metadata: unknown): readonly TileRange[] | null {
  if (typeof metadata !== 'object' || metadata === null || !(COVERAGE_KEY in metadata)) return null
  const ranges: unknown = metadata[COVERAGE_KEY]
  if (!Array.isArray(ranges)) return null
  const list: unknown[] = ranges
  return list.every(isRange) ? list : null
}
