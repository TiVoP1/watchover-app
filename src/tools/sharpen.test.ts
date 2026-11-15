import { describe, expect, it } from 'vitest'
import type { Catalog, PlaceData, RadarMeta } from '#web/data/types.ts'
import { MOTION } from '#web/tokens.ts'
import {
  buildSchedule,
  cropPixels,
  leftLabel,
  MAX_SCREEN_PX_PER_IMAGE_PX,
  MIN_SCREEN_PX_PER_IMAGE_PX,
  plateText,
  type SharpenStack,
  screenScale,
  sharpenLayout,
  sharpenStack,
  sharpenTarget,
  stepAt,
  targetShare,
} from '#web/tools/sharpen.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar}.json',
    '/public/data/mexico-city/{catalog,radar}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null

function place(slug: string): PlaceData {
  return {
    slug,
    catalog: file(`${slug}/catalog.json`) as Catalog,
    radar: file(`${slug}/radar.json`) as RadarMeta,
    clouds: null,
    weather: null,
    insar: null,
    objects: null,
    events: null,
    footprints: null,
    nullCheck: null,
    story: null,
    ground: null,
    play: null,
    eventPairs: null,
  }
}

const WARSAW = 'Europe/Warsaw'
const IMAGE = { width: 1500, height: 1500 }
const VIEW_1280 = { width: 912, height: 508 }
const VIEW_1920 = { width: 1552, height: 868 }
const stalowaWola = place('stalowa-wola')
const radar = stalowaWola.radar as RadarMeta

function stack(): SharpenStack {
  const found = sharpenStack(radar)
  if (found === null) throw new Error('radar.json of Stalowa Wola has no Sharpen stack')
  return found
}

const matrix = (transform: string): number[] => (transform.match(/-?[\d.e-]+/g) ?? []).map(Number)

describe('sharpenStack', () => {
  it('stacks the dawn passes of one track, starting from a single pass', () => {
    expect(stack().steps.map((s) => s.looks)).toEqual([1, 2, 4, 8, 16, 17])
    expect(stack().track).toBe(28)
    expect(stack().part).toBe('dawn')
  })

  it('offers nothing to sharpen without a second step or a single first pass', () => {
    const [first, second] = radar.sharpen.steps
    if (first === undefined || second === undefined) throw new Error('two steps expected')
    expect(sharpenStack({ ...radar, sharpen: { track: 28, steps: [first] } })).toBeNull()
    expect(sharpenStack({ ...radar, sharpen: { track: 28, steps: [second] } })).toBeNull()
    expect(sharpenStack(null)).toBeNull()
  })
})

describe('build sequence', () => {
  it('shows 1 pass when the fly ends, then 2, 4, 8, 16 and 17, one step every 500 ms', () => {
    const steps = buildSchedule(stack().steps.length, MOTION.sharpenStepMs)
    expect(steps.map((s) => [stepAt(stack(), s.index).looks, s.atMs])).toEqual([
      [2, 500],
      [4, 1000],
      [8, 1500],
      [16, 2000],
      [17, 2500],
    ])
  })

  it('hands over all 17 passes within 4 s of opening', () => {
    const last = buildSchedule(stack().steps.length, MOTION.sharpenStepMs).at(-1)
    expect(last?.index).toBe(stack().steps.length - 1)
    expect(MOTION.flyMs + (last?.atMs ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(4000)
  })

  it('keeps the slider inside the stack, so there is no position 0', () => {
    expect(stepAt(stack(), -1).looks).toBe(1)
    expect(stepAt(stack(), 99).looks).toBe(17)
    expect(buildSchedule(1, MOTION.sharpenStepMs)).toEqual([])
  })
})

describe('plate and labels', () => {
  it('names the stack shown on the right, with local dates', () => {
    expect(plateText(stack(), 5, WARSAW)).toBe(
      'Average of 17 dawn passes, track 28, 19 Oct 2025 to 26 Oct 2026',
    )
    expect(plateText(stack(), 3, WARSAW)).toBe(
      'Average of 8 dawn passes, track 28, 19 Oct 2025 to 28 Jun 2026',
    )
  })

  it('names one pass without an average', () => {
    expect(plateText(stack(), 0, WARSAW)).toBe('1 dawn pass, track 28, 19 Oct 2025')
    expect(leftLabel(stack(), WARSAW)).toBe('1 pass, 19 Oct 2025')
  })
})

describe('layout', () => {
  it('crops about 3 km of 20 m pixels', () => {
    expect(cropPixels(radar, IMAGE)).toBe(150)
  })

  it('draws one radar pixel as 3 screen pixels at 1280 x 720 and 4 at 1920 x 1080', () => {
    expect(screenScale(VIEW_1280.height, 150)).toBe(3)
    expect(screenScale(VIEW_1920.height, 150)).toBe(4)
    expect(screenScale(200, 150)).toBe(MIN_SCREEN_PX_PER_IMAGE_PX)
    expect(screenScale(4000, 150)).toBe(MAX_SCREEN_PX_PER_IMAGE_PX)
  })

  it('aims at the steelworks, with the San meander inside the view', () => {
    const share = targetShare(radar, sharpenTarget(stalowaWola))
    expect(share.u * IMAGE.width).toBeCloseTo(770, -1)
    expect(share.v * IMAGE.height).toBeCloseTo(900, -1)
  })

  it('falls back to the catalog centre of a place without a chosen target', () => {
    const mexico = place('mexico-city')
    expect(sharpenTarget(mexico)).toEqual([mexico.catalog.place.lon, mexico.catalog.place.lat])
  })

  it('puts the target in the middle of the view at rest', () => {
    const share = targetShare(radar, sharpenTarget(stalowaWola))
    const layout = sharpenLayout(VIEW_1280, IMAGE, share, 150)
    expect(layout.width).toBe(IMAGE.width * 3)
    expect(layout.left + share.u * layout.width).toBeCloseTo(VIEW_1280.width / 2)
    expect(layout.top + share.v * layout.height).toBeCloseTo(VIEW_1280.height / 2)
  })

  it('starts the fly from the whole square fitted and centred in the view', () => {
    const share = targetShare(radar, sharpenTarget(stalowaWola))
    const layout = sharpenLayout(VIEW_1920, IMAGE, share, 150)
    const [k = 0, , , , dx = 0, dy = 0] = matrix(layout.overview)
    const left = k * layout.left + dx
    const top = k * layout.top + dy
    const side = k * layout.width
    expect(side).toBeLessThan(VIEW_1920.height)
    expect(left + side / 2).toBeCloseTo(VIEW_1920.width / 2)
    expect(top + side / 2).toBeCloseTo(VIEW_1920.height / 2)
  })
})
