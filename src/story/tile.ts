import { EN } from '#web/i18n/en.ts'
import type { HeatOrbit, Tile, TileImage, TileMap } from '#web/story/chapters.ts'
import type { PixelRect, UnitRect } from '#web/story/crop.ts'
import { cloudPercent } from '#web/story/story-text.ts'
import { formatDateSpan, formatNumber, formatShortDate, withUnit } from '#web/ui/format.ts'

export type Side = 'before' | 'after'

export interface Face {
  readonly path: string
  readonly crop: UnitRect
  readonly outline: UnitRect | null
  readonly mask: string | null
  readonly maskCrop?: UnitRect
  readonly maskOpaque?: boolean
  readonly label: string
}

export interface CanvasPlan {
  readonly width: number
  readonly height: number
  readonly smooth: boolean
}

export interface ChartPoint {
  readonly x: number
  readonly y: number
}

export interface ChartPass {
  readonly x: number
  readonly time: string
  readonly tempC: number | null
}

export interface HeatGeometry {
  readonly air: readonly ChartPoint[]
  readonly move: readonly ChartPoint[]
  readonly zero: number
  readonly hot: ChartPass
  readonly cold: ChartPass
}

const NEAREST_MAX_SOURCE_PX = 240
const TILE_MAX_PX = 340
const DEVICE_PIXEL_RATIO_MAX = 2
const SHRUNK_CANVAS_PX = TILE_MAX_PX * DEVICE_PIXEL_RATIO_MAX
const WHOLE_VIEW_SHARE = 0.9
const OUTLINE_GAP_SHARE = 0.02
const PIXEL_EDGE_EPS = 1e-6

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export const otherSide = (side: Side): Side => (side === 'before' ? 'after' : 'before')

const mapSpan = (map: TileMap, timeZone: string): string =>
  EN.tile.span(...formatDateSpan(map.from, map.to, timeZone))

export function tileFaces(tile: Tile, timeZone: string): readonly [Face, Face] | null {
  const day = (image: TileImage) => formatShortDate(image.time, timeZone)
  switch (tile.variant) {
    case 'radar': {
      const face = (image: TileImage, mask: string | null, label: string): Face => ({
        path: image.path,
        crop: tile.crop,
        outline: tile.outline,
        mask,
        ...(mask === null || tile.maskCrop === undefined ? {} : { maskCrop: tile.maskCrop }),
        ...(mask === null || tile.maskOpaque !== true ? {} : { maskOpaque: true }),
        label,
      })
      const map = tile.maskOpaque === true ? tile.map : undefined
      return [
        face(tile.before, null, day(tile.before)),
        face(tile.after, tile.mask, map === undefined ? day(tile.after) : mapSpan(map, timeZone)),
      ]
    }
    case 'coherence': {
      const face = (image: TileImage): Face => ({
        path: image.path,
        crop: tile.crop,
        outline: tile.outline,
        mask: null,
        label:
          image.from === null
            ? day(image)
            : EN.tile.span(formatShortDate(image.from, timeZone), day(image)),
      })
      return [face(tile.before), face(tile.after)]
    }
    case 'clouds':
      return [
        {
          path: tile.optical.path,
          crop: tile.opticalCrop,
          outline: tile.opticalOutline,
          mask: null,
          label: EN.tile.photo(day(tile.optical), cloudPercent(tile.cloudShare)),
        },
        {
          path: tile.radar.path,
          crop: tile.radarCrop,
          outline: tile.outline,
          mask: null,
          label: EN.tile.radar(day(tile.radar)),
        },
      ]
    case 'chart':
      return null
  }
}

export function tilePaths(tile: Tile): readonly string[] {
  const faces = tileFaces(tile, 'UTC') ?? []
  const paths = faces.flatMap((f) => (f.mask === null ? [f.path] : [f.path, f.mask]))
  return [...new Set(paths)]
}

export function tileKey(tile: Tile): string {
  if (tile.variant === 'chart') return `chart:${tile.heat.object.osm}`
  const crop = tile.variant === 'clouds' ? tile.radarCrop : tile.crop
  const at = [crop.x, crop.y, crop.w, crop.h].map((v) => v.toFixed(6)).join(',')
  return `${tile.variant}:${tilePaths(tile).join('|')}:${at}`
}

export function sourceRect(crop: UnitRect, widthPx: number, heightPx: number): PixelRect {
  const x = clamp(Math.floor(crop.x * widthPx + PIXEL_EDGE_EPS), 0, widthPx - 1)
  const y = clamp(Math.floor(crop.y * heightPx + PIXEL_EDGE_EPS), 0, heightPx - 1)
  const right = clamp(Math.ceil((crop.x + crop.w) * widthPx - PIXEL_EDGE_EPS), x + 1, widthPx)
  const bottom = clamp(Math.ceil((crop.y + crop.h) * heightPx - PIXEL_EDGE_EPS), y + 1, heightPx)
  return { x, y, w: right - x, h: bottom - y }
}

export function outlineIn(
  crop: UnitRect,
  outline: UnitRect,
  rect: PixelRect,
  widthPx: number,
  heightPx: number,
): UnitRect {
  const left = (crop.x + outline.x * crop.w) * widthPx
  const top = (crop.y + outline.y * crop.h) * heightPx
  return {
    x: (left - rect.x) / rect.w,
    y: (top - rect.y) / rect.h,
    w: (outline.w * crop.w * widthPx) / rect.w,
    h: (outline.h * crop.h * heightPx) / rect.h,
  }
}

export function drawnOutline(face: Face, widthPx: number, heightPx: number): UnitRect | null {
  if (face.outline === null) return null
  const rect = sourceRect(face.crop, widthPx, heightPx)
  const { x, y, w, h } = outlineIn(face.crop, face.outline, rect, widthPx, heightPx)
  const gap = OUTLINE_GAP_SHARE
  const left = clamp(x - gap, gap, 1 - gap)
  const top = clamp(y - gap, gap, 1 - gap)
  const right = clamp(x + w + gap, left, 1 - gap)
  const bottom = clamp(y + h + gap, top, 1 - gap)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

export function canvasPlan(rect: PixelRect): CanvasPlan {
  const longest = Math.max(rect.w, rect.h)
  if (longest <= NEAREST_MAX_SOURCE_PX) return { width: rect.w, height: rect.h, smooth: false }
  const scale = Math.min(1, SHRUNK_CANVAS_PX / longest)
  return {
    width: Math.max(1, Math.round(rect.w * scale)),
    height: Math.max(1, Math.round(rect.h * scale)),
    smooth: true,
  }
}

const wholeView = (crop: UnitRect): boolean =>
  crop.w >= WHOLE_VIEW_SHARE && crop.h >= WHOLE_VIEW_SHARE

export function tileLegend(tile: Tile): string | null {
  if (tile.variant === 'coherence') return EN.tile.legendCoherence
  if (tile.variant !== 'radar') return null
  if (tile.legend !== undefined) return tile.legend
  if (tile.mask !== null) return EN.tile.legendFrost
  return tile.colour === 'false' ? EN.tile.legendFalse : null
}

const pixelText = (metres: number): string => withUnit(formatNumber(metres), EN.units.m)

export function tileFinePrint(tile: Tile, pixelM: number | null): string {
  switch (tile.variant) {
    case 'radar': {
      if (tile.maskOpaque === true) {
        return tile.map === undefined
          ? EN.tile.changeMapOnly
          : EN.tile.changeMap(tile.map.product, pixelText(tile.map.pixelM))
      }
      if (pixelM === null) return EN.tile.radarOnly
      const pixel = pixelText(pixelM)
      return wholeView(tile.crop) ? EN.tile.wholeView(pixel) : EN.tile.magnified(pixel)
    }
    case 'coherence':
      return EN.tile.pairs
    case 'clouds':
      return EN.tile.clouds
    case 'chart':
      return EN.tile.chartFine
  }
}

const shareOf = (value: number, low: number, high: number) =>
  high === low ? 0.5 : (high - value) / (high - low)

export function heatGeometry(orbit: HeatOrbit): HeatGeometry | null {
  const times = orbit.passes.map((p) => Date.parse(p.time))
  const first = Math.min(...times)
  const last = Math.max(...times)
  const temps = orbit.passes.flatMap((p) => (p.tempC === null ? [] : [p.tempC]))
  const mms = orbit.passes.flatMap((p) => (p.losMmFromColdest === null ? [] : [p.losMmFromColdest]))
  const hot = orbit.passes[orbit.hot]
  const cold = orbit.passes[orbit.cold]
  if (!(last > first) || temps.length < 2 || mms.length < 2) return null
  if (hot === undefined || cold === undefined) return null
  const x = (time: string) => (Date.parse(time) - first) / (last - first)
  const tLow = Math.min(...temps)
  const tHigh = Math.max(...temps)
  const mLow = Math.min(0, ...mms)
  const mHigh = Math.max(0, ...mms)
  return {
    air: orbit.passes.flatMap((p) =>
      p.tempC === null ? [] : [{ x: x(p.time), y: shareOf(p.tempC, tLow, tHigh) }],
    ),
    move: orbit.passes.flatMap((p) =>
      p.losMmFromColdest === null
        ? []
        : [{ x: x(p.time), y: shareOf(p.losMmFromColdest, mLow, mHigh) }],
    ),
    zero: shareOf(0, mLow, mHigh),
    hot: { x: x(hot.time), time: hot.time, tempC: hot.tempC },
    cold: { x: x(cold.time), time: cold.time, tempC: cold.tempC },
  }
}
