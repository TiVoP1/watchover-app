import { describe, expect, it } from 'vitest'
import { isNullCheck } from '#web/data/load.ts'
import type {
  Catalog,
  Clouds,
  Events,
  InsarMeta,
  Objects,
  PlaceData,
  RadarMeta,
  Weather,
} from '#web/data/types.ts'
import { buildStory, type Chapter } from '#web/story/chapters.ts'
import {
  canvasPlan,
  drawnOutline,
  heatGeometry,
  otherSide,
  outlineIn,
  type Side,
  sourceRect,
  tileFaces,
  tileFinePrint,
  tileKey,
  tileLegend,
  tilePaths,
} from '#web/story/tile.ts'
import { MOTION } from '#web/tokens.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar,clouds,weather,events}.json',
    '/public/data/stalowa-wola/insar/{insar,objects,null_check}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/stalowa-wola/${path}`] ?? null
const nullCheck = file('insar/null_check.json')
const data: PlaceData = {
  slug: 'stalowa-wola',
  catalog: file('catalog.json') as Catalog,
  radar: file('radar.json') as RadarMeta,
  clouds: file('clouds.json') as Clouds,
  weather: file('weather.json') as Weather,
  insar: file('insar/insar.json') as InsarMeta,
  objects: file('insar/objects.json') as Objects,
  events: file('events.json') as Events,
  footprints: null,
  nullCheck: isNullCheck(nullCheck) ? nullCheck : null,
  story: null,
  ground: null,
  play: null,
  eventPairs: null,
}
const framePx = (file('radar.json') as { readonly out_px: number }).out_px
const story = buildStory(data)
const ZONE = 'Europe/Warsaw'
const NBSP = ' '

function chapter(n: number): Chapter {
  const found = story.chapters.find((c) => c.n === n)
  if (found === undefined) throw new Error(`chapter ${String(n)}`)
  return found
}

describe('tileFaces', () => {
  it('flips the forest patch from 17 Jul to 10 Aug with the outline standing still', () => {
    const faces = tileFaces(chapter(2).insetTile, ZONE)
    expect(faces?.map((f) => f.label)).toEqual(['17 Jul', '10 Aug'])
    expect(faces?.[0].outline).toEqual(faces?.[1].outline)
    expect(faces?.[0].crop).toEqual(faces?.[1].crop)
    expect(faces?.every((f) => f.path.startsWith('radar/false/'))).toBe(true)
  })

  it('lays the frost mask on the after face only', () => {
    const faces = tileFaces(chapter(1).insetTile, ZONE)
    expect(faces?.map((f) => f.label)).toEqual(['13 Dec', '25 Dec'])
    expect(faces?.map((f) => f.mask)).toEqual([null, 'events/frost.png'])
    expect(faces?.[1].outline).toBeNull()
  })

  it('dates each coherence face by the two visits of its pair', () => {
    const faces = tileFaces(chapter(5).insetTile, ZONE)
    expect(faces?.map((f) => f.label)).toEqual(['20 Sept to 2 Oct', '2 Oct to 14 Oct'])
  })

  it('names the cloudy photo with its day and cloud share, and the radar of the same day', () => {
    const faces = tileFaces(chapter(3).insetTile, ZONE)
    expect(faces?.map((f) => f.label)).toEqual([
      'Photo, 15 Sept, about 68% cloud in the view',
      'Radar, 15 Sept',
    ])
    expect(faces?.[0].crop).not.toEqual(faces?.[1].crop)
  })

  it('has no faces for the building chart', () => {
    expect(tileFaces(chapter(6).insetTile, ZONE)).toBeNull()
  })
})

describe('flip timing', () => {
  it('ends every Play stop on the after face', () => {
    const faces = MOTION.changePassMs / MOTION.flipMs
    expect(Number.isInteger(faces)).toBe(true)
    let side: Side = 'before'
    for (let shown = 1; shown < faces; shown++) side = otherSide(side)
    expect(side).toBe('after')
  })
})

describe('tilePaths and tileKey', () => {
  it('loads the mask with the frost images and nothing for the chart', () => {
    expect(tilePaths(chapter(1).insetTile)).toHaveLength(3)
    expect(tilePaths(chapter(3).insetTile)).toEqual([
      'optical/2026-09-15.webp',
      'radar/grey/20260915T032155_129A.webp',
    ])
    expect(tilePaths(chapter(6).insetTile)).toEqual([])
  })

  it('gives every chapter tile its own key and the same tile the same key', () => {
    const keys = story.chapters.map((c) => tileKey(c.insetTile))
    expect(new Set(keys).size).toBe(story.chapters.length)
    expect(tileKey(chapter(2).tile)).toBe(tileKey(chapter(2).insetTile))
    expect(tileKey(chapter(3).tile)).not.toBe(tileKey(chapter(3).insetTile))
  })
})

describe('sourceRect', () => {
  it('covers the crop with whole pixels', () => {
    expect(sourceRect({ x: 0.1, y: 0.2, w: 0.05, h: 0.05 }, 1500, 1500)).toEqual({
      x: 150,
      y: 300,
      w: 75,
      h: 75,
    })
    expect(sourceRect({ x: 0.10003, y: 0.2, w: 0.05, h: 0.05 }, 1500, 1500)).toEqual({
      x: 150,
      y: 300,
      w: 76,
      h: 75,
    })
  })

  it('stays inside the image and never comes out empty', () => {
    expect(sourceRect({ x: 0.99, y: -0.1, w: 0.2, h: 0.3 }, 500, 500)).toEqual({
      x: 495,
      y: 0,
      w: 5,
      h: 100,
    })
    expect(sourceRect({ x: 0.5, y: 0.5, w: 0, h: 0 }, 500, 500)).toEqual({
      x: 250,
      y: 250,
      w: 1,
      h: 1,
    })
  })
})

describe('outlineIn and drawnOutline', () => {
  it('keeps the outline on the same image pixels when the rect grows to whole pixels', () => {
    const crop = { x: 0.10003, y: 0.2001, w: 0.05, h: 0.05 }
    const outline = { x: 0.25, y: 0.3, w: 0.5, h: 0.2 }
    const rect = sourceRect(crop, 1500, 1500)
    const moved = outlineIn(crop, outline, rect, 1500, 1500)
    expect(rect.x + moved.x * rect.w).toBeCloseTo((crop.x + outline.x * crop.w) * 1500, 9)
    expect(rect.y + moved.y * rect.h).toBeCloseTo((crop.y + outline.y * crop.h) * 1500, 9)
    expect(moved.w * rect.w).toBeCloseTo(outline.w * crop.w * 1500, 9)
  })

  it('strokes the forest outline just outside the patch and none on the whole view', () => {
    const [face] = tileFaces(chapter(2).insetTile, ZONE) ?? []
    const [frost] = tileFaces(chapter(1).insetTile, ZONE) ?? []
    if (face === undefined || frost === undefined || face.outline === null) throw new Error('faces')
    const drawn = drawnOutline(face, framePx, framePx)
    const exact = outlineIn(
      face.crop,
      face.outline,
      sourceRect(face.crop, framePx, framePx),
      framePx,
      framePx,
    )
    expect(drawn?.x).toBeLessThan(exact.x)
    expect(drawn?.w).toBeGreaterThan(exact.w)
    expect(drawnOutline(frost, framePx, framePx)).toBeNull()
  })
})

describe('canvasPlan', () => {
  it('copies a small crop pixel for pixel and lets the page magnify it with nearest sampling', () => {
    expect(canvasPlan({ x: 0, y: 0, w: 75, h: 75 })).toEqual({
      width: 75,
      height: 75,
      smooth: false,
    })
  })

  it('shrinks the whole view smoothly', () => {
    expect(canvasPlan({ x: 0, y: 0, w: 1500, h: 1500 })).toEqual({
      width: 680,
      height: 680,
      smooth: true,
    })
    expect(canvasPlan({ x: 0, y: 0, w: 300, h: 300 })).toEqual({
      width: 300,
      height: 300,
      smooth: true,
    })
  })

  it('magnifies every zoomed chapter crop and shrinks only the frozen whole view', () => {
    const smooth = [1, 2, 4].map((n) => {
      const [face] = tileFaces(chapter(n).insetTile, ZONE) ?? []
      if (face === undefined) throw new Error('face')
      return canvasPlan(sourceRect(face.crop, framePx, framePx)).smooth
    })
    expect(smooth).toEqual([true, false, false])
  })
})

describe('tileLegend and tileFinePrint', () => {
  it('explains the colours only where the tile uses them', () => {
    expect(tileLegend(chapter(1).insetTile)).toBe('White: where the frost dimmed the radar.')
    expect(tileLegend(chapter(2).insetTile)).toBe(
      'False colour radar: R HH, G HV, B HH/HV. Green = trees, blue and violet = bare or smooth ground.',
    )
    expect(tileLegend(chapter(3).insetTile)).toBeNull()
    expect(tileLegend(chapter(4).insetTile)).toBeNull()
    expect(tileLegend(chapter(5).insetTile)).toBe(
      'Bright: the ground stopped matching its usual pattern.',
    )
  })

  it('says magnified for a zoomed crop and the whole area for the frozen view', () => {
    expect(tileFinePrint(chapter(2).insetTile, 20)).toBe(
      `NISAR radar, 20${NBSP}m pixels, magnified.`,
    )
    expect(tileFinePrint(chapter(1).insetTile, 20)).toBe(
      `NISAR radar, the whole watched area, 20${NBSP}m pixels.`,
    )
    expect(tileFinePrint(chapter(2).insetTile, null)).toBe('NISAR radar.')
    expect(tileFinePrint(chapter(6).insetTile, 20)).toContain('NASA POWER estimate')
  })
})

describe('heatGeometry', () => {
  it('draws the evening orbit with zero at the coldest pass and the peak on 16 Jul', () => {
    const building = chapter(6)
    if (building.kind !== 'heat' || building.heat.evening === null) throw new Error('heat')
    const geometry = heatGeometry(building.heat.evening)
    if (geometry === null) throw new Error('geometry')
    expect(geometry.cold).toMatchObject({ x: 1, tempC: 10.6 })
    expect(geometry.hot.time.slice(0, 10)).toBe('2026-07-16')
    expect(geometry.hot.x).toBeGreaterThan(0)
    expect(geometry.hot.x).toBeLessThan(0.5)
    expect(geometry.zero).toBe(1)
    expect(geometry.air).toHaveLength(9)
    expect(geometry.move).toHaveLength(9)
    const peak = (points: readonly { x: number; y: number }[]) =>
      points.reduce((best, p) => (p.y < best.y ? p : best))
    expect(peak(geometry.air).x).toBe(geometry.hot.x)
    expect(peak(geometry.move).x).toBe(geometry.hot.x)
  })

  it('needs two dated passes with values', () => {
    const building = chapter(6)
    if (building.kind !== 'heat' || building.heat.evening === null) throw new Error('heat')
    const [first] = building.heat.evening.passes
    if (first === undefined) throw new Error('pass')
    expect(heatGeometry({ ...building.heat.evening, passes: [first] })).toBeNull()
  })
})
