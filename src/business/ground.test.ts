import { describe, expect, it } from 'vitest'
import {
  cropCorners,
  groundBecause,
  groundExample,
  groundFacts,
  groundHeadline,
  groundKey,
  groundMeta,
  groundOverlay,
  groundSource,
} from '#web/business/ground.ts'
import { GROUND_LAYOUT, groundPlot } from '#web/business/ground-plot.ts'
import { isGround, isPlaceStory } from '#web/data/load.ts'
import type { Catalog, Ground, PlaceData, PlaceStory, RadarMeta } from '#web/data/types.ts'

const files = import.meta.glob<unknown>(
  '/public/data/mexico-city/{catalog,story,ground,radar}.json',
  {
    eager: true,
    import: 'default',
  },
)

const file = (name: string): unknown => files[`/public/data/mexico-city/${name}`] ?? null
const storyFile = file('story.json')
const groundFile = file('ground.json')
const story: PlaceStory | null = isPlaceStory(storyFile) ? storyFile : null
const ground: Ground | null = isGround(groundFile) ? groundFile : null

const data: PlaceData = {
  slug: 'mexico-city',
  catalog: file('catalog.json') as Catalog,
  radar: null,
  clouds: null,
  weather: null,
  insar: null,
  objects: null,
  events: null,
  footprints: null,
  nullCheck: null,
  play: null,
  eventPairs: null,
  story,
  ground,
}

const ZONE = 'America/Mexico_City'
const NBSP = ' '

const example = () => {
  const found = groundExample(data)
  if (found === null) throw new Error('no ground clock')
  return found
}

describe('groundExample', () => {
  it('joins the ground chapter of story.json with ground.json', () => {
    const found = example()
    expect(found.ground.district.name).toBe('Nezahualcóyotl')
    expect(found.movedAway).toEqual({ value: 19, unit: 'cm', range: [10.4, 21.7] })
    expect(found).toMatchObject({
      days: 348,
      pairs: 28,
      steadyPairs: 27,
      hills: 5,
      hillsMaxMm: 9.5,
    })
    expect(found.centre.values.at(-1)).toBe(-20.7)
    expect(found.firm.values).toHaveLength(found.centre.dates.length)
  })

  it('needs both files', () => {
    expect(groundExample({ ...data, ground: null })).toBeNull()
    expect(groundExample({ ...data, story: null })).toBeNull()
    expect(groundExample({ ...data, story: null, ground: null })).toBeNull()
  })
})

describe('ground copy', () => {
  it('headlines the district median and the span in days', () => {
    expect(groundHeadline(example())).toBe(
      `Nezahualcóyotl moved 19${NBSP}cm away from the radar in 348 days.`,
    )
  })

  it('states where, when in the local time of the place, and how sure', () => {
    expect(groundFacts(example(), ZONE)).toBe('Nezahualcóyotl, 30 Oct 2025 to 13 Oct 2026, clear')
  })

  it('explains with the pairs and the firm hills, rounded up to the whole centimetre', () => {
    expect(groundBecause(example())).toBe(
      `28 NISAR pairs in a row, 27 of them 12 days apart. 5 rock and lava hills ended within 1${NBSP}cm of where they started.`,
    )
    expect(groundBecause({ ...example(), hillsMaxMm: 10.5 })).toContain(`within 2${NBSP}cm`)
  })

  it('carries the honest meta: spread, line of sight, reference, pixel size, atmosphere, cause', () => {
    expect(groundMeta(example())).toBe(
      `Median of the district; most of it moved 10 to 22${NBSP}cm. Along the radar's line of sight, relative to Lomas de Chapultepec. 80 m pixels: districts, not buildings. No correction for the atmosphere yet. We see the ground move, not why.`,
    )
    const corrected = { ...example(), ground: { ...example().ground, atmosphere_corrected: true } }
    expect(groundMeta(corrected)).not.toMatch(/atmosphere/)
  })

  it('keys the map with the scale of the overlay', () => {
    expect(groundKey(example())).toBe(
      `Map: red moved away from the radar, blue towards it; strongest colour at 30${NBSP}cm.`,
    )
  })

  it('makes no promise and no claim about single buildings', () => {
    const texts = [groundHeadline(example()), groundBecause(example()), groundMeta(example())]
    for (const text of texts) {
      expect(text).not.toMatch(/guarantee|safe|damage|will sink|risk-free/i)
      expect(text).not.toMatch(new RegExp('[\u2013\u2014]'))
    }
  })
})

describe('groundOverlay', () => {
  const image = story?.chapters[0]?.overlay?.corners_lonlat

  it('draws the whole overlay image of the chapter when there is no watched square', () => {
    expect(groundOverlay(data)).toEqual({
      url: '/data/mexico-city/ground/los_total.webp',
      image,
      crop: { x: 0, y: 0, w: 1, h: 1 },
    })
    expect(groundOverlay({ ...data, ground: null })).toBeNull()
  })

  it('crops the overlay to the watched square, so nothing is drawn in the fog', () => {
    const radar = file('radar.json') as RadarMeta
    const overlay = groundOverlay({ ...data, radar })
    if (overlay === null || image === undefined) throw new Error('no overlay')
    const { crop } = overlay
    expect(crop.x).toBeGreaterThan(0)
    expect(crop.y).toBeGreaterThan(0)
    expect(crop.x + crop.w).toBeLessThan(1)
    expect(crop.y + crop.h).toBeLessThan(1)
    const corners = cropCorners(image, crop)
    radar.corners_lonlat.forEach(([lon, lat], i) => {
      expect(corners[i]?.[0]).toBeCloseTo(lon, 2)
      expect(corners[i]?.[1]).toBeCloseTo(lat, 2)
    })
  })

  it('maps the whole image back onto its own corners', () => {
    if (image === undefined) throw new Error('no overlay')
    expect(cropCorners(image, { x: 0, y: 0, w: 1, h: 1 })).toEqual(image)
  })
})

describe('groundSource', () => {
  it('traces the clock to the GUNW pairs in UTC', () => {
    const source = groundSource(example())
    expect(source?.line).toBe(
      'NISAR GUNW, track 19 ascending, 30 Oct 2025 to 13 Oct 2026, 12:05 UTC',
    )
    expect(source?.scenes).toHaveLength(28)
    expect(source?.district).toBe('District boundary: OpenStreetMap relation/5606086')
  })
})

describe('groundPlot', () => {
  const width = 336

  it('places both series on one axis with zero at the first pass', () => {
    const plot = groundPlot(example(), width)
    if (plot === null) throw new Error('no plot')
    const [top, bottom] = GROUND_LAYOUT.plot
    expect(plot.centre).toHaveLength(29)
    expect(plot.firm).toHaveLength(29)
    expect(plot.centre[0]?.y).toBeCloseTo(plot.zero, 6)
    expect(plot.firm[0]?.y).toBeCloseTo(plot.zero, 6)
    const lowest = Math.max(...plot.centre.map((p) => p.y))
    expect(lowest).toBeLessThanOrEqual(bottom)
    expect(Math.min(...plot.firm.map((p) => p.y))).toBeGreaterThanOrEqual(top)
    expect(plot.centre.at(-1)?.y).toBe(lowest)
  })

  it('keeps month labels apart and hover columns edge to edge', () => {
    const plot = groundPlot(example(), width)
    if (plot === null) throw new Error('no plot')
    const gaps = plot.months.slice(1).map((m, i) => m.x - (plot.months[i]?.x ?? 0))
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(44)
    expect(plot.columns[0]?.from).toBe(GROUND_LAYOUT.left)
    expect(plot.columns.at(-1)?.to).toBe(width - GROUND_LAYOUT.right)
    expect(plot.ticks.map((t) => t.value)).toContain(0)
  })

  it('needs room to draw', () => {
    expect(groundPlot(example(), 40)).toBeNull()
  })
})
