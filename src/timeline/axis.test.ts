import { describe, expect, it } from 'vitest'
import type { Catalog, PlaceData, RadarMeta } from '#web/data/types.ts'
import { buildStory } from '#web/story/chapters.ts'
import {
  type AxisOptions,
  buildAxis,
  nearestIndex,
  spread,
  timeScale,
  tintsAllKinds,
} from '#web/timeline/axis.ts'
import { formatMonth, formatMonthYear } from '#web/ui/format.ts'

const files = import.meta.glob<unknown>('/public/data/stalowa-wola/{catalog,radar}.json', {
  eager: true,
  import: 'default',
})

const data: PlaceData = {
  slug: 'stalowa-wola',
  catalog: files['/public/data/stalowa-wola/catalog.json'] as Catalog,
  radar: files['/public/data/stalowa-wola/radar.json'] as RadarMeta,
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
const story = buildStory(data)
const times = (data.radar?.frames ?? []).map((f) => Date.parse(f.time))
const gap =
  story.gap === null ? null : { from: Date.parse(story.gap.from), to: Date.parse(story.gap.to) }
const t = (iso: string) => Date.parse(iso)

const named =
  (zone: string) =>
  (at: number, withYear: boolean): string =>
    withYear ? formatMonthYear(new Date(at).toISOString(), zone) : formatMonth(new Date(at), zone)

const options = (width: number, zone = 'Europe/Warsaw'): AxisOptions => ({
  width,
  padPx: 16,
  gapPx: 128,
  labelOffsetPx: 4,
  charPx: 6.5,
  monthName: named(zone),
})

describe('timeScale', () => {
  const x = timeScale(
    t('2025-10-19T00:00:00Z'),
    t('2026-11-01T00:00:00Z'),
    { from: t('2026-01-18T00:00:00Z'), to: t('2026-06-17T00:00:00Z') },
    16,
    1016,
    128,
  )

  it('puts the first and last pass on the padded ends and squeezes the gap to its width', () => {
    expect(x(t('2025-10-19T00:00:00Z'))).toBe(16)
    expect(x(t('2026-11-01T00:00:00Z'))).toBeCloseTo(1016, 6)
    expect(x(t('2026-06-17T00:00:00Z')) - x(t('2026-01-18T00:00:00Z'))).toBeCloseTo(128, 6)
  })

  it('keeps the same pace on both sides of the gap', () => {
    const before = x(t('2026-01-18T00:00:00Z')) - x(t('2026-01-08T00:00:00Z'))
    const after = x(t('2026-06-27T00:00:00Z')) - x(t('2026-06-17T00:00:00Z'))
    expect(after).toBeCloseTo(before, 6)
  })

  it('runs straight without a gap', () => {
    const plain = timeScale(0, 100, null, 10, 210, 128)
    expect(plain(50)).toBe(110)
  })
})

describe('buildAxis on Stalowa Wola', () => {
  const wide = buildAxis(times, gap, options(1552))

  it('draws one tick per pass in time order and the gap between the passes around it', () => {
    expect(wide.ticks).toHaveLength(52)
    expect([...wide.ticks].sort((a, b) => a - b)).toEqual(wide.ticks)
    expect(wide.ticks[0]).toBe(16)
    expect(wide.ticks.at(-1)).toBeCloseTo(1536, 6)
    const lastBefore = story.gap?.lastBefore ?? -1
    expect(wide.gap?.from).toBe(wide.ticks[lastBefore])
    expect((wide.gap?.to ?? 0) - (wide.gap?.from ?? 0)).toBeCloseTo(128, 6)
    expect(wide.ticks[lastBefore + 1]).toBeGreaterThan(wide.gap?.to ?? Infinity)
  })

  it('draws no month line inside the gap', () => {
    const inside = wide.lines.filter((x) => x > (wide.gap?.from ?? 0) && x < (wide.gap?.to ?? 0))
    expect(inside).toEqual([])
  })

  it('names June right after the gap and shows the year on the first label and in January', () => {
    expect(wide.labels.map((l) => l.text)).toEqual([
      'Oct 2025',
      'Nov',
      'Dec',
      'Jan 2026',
      'Jun',
      'Jul',
      'Aug',
      'Sept',
      'Oct',
    ])
    const june = wide.labels.find((l) => l.text === 'Jun')
    expect(june?.x).toBeCloseTo((wide.gap?.to ?? 0) + 4, 6)
  })

  it('never lets month labels run into each other, at any width', () => {
    for (const width of [480, 912, 1280, 1552]) {
      const axis = buildAxis(times, gap, options(width))
      for (const [i, label] of axis.labels.entries()) {
        const next = axis.labels[i + 1]
        const end = label.x + label.text.length * 6.5
        if (next !== undefined) expect(end).toBeLessThanOrEqual(next.x)
        expect(end).toBeLessThanOrEqual(width)
      }
    }
  })

  it('names the months the same far east and far west of Greenwich', () => {
    const utc = buildAxis(times, gap, options(1552, 'UTC')).labels.map((l) => l.text)
    for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Mexico_City']) {
      expect(buildAxis(times, gap, options(1552, zone)).labels.map((l) => l.text)).toEqual(utc)
    }
  })

  it('ignores a gap that does not sit between the passes', () => {
    const outside = { from: t('2024-01-01T00:00:00Z'), to: t('2024-03-01T00:00:00Z') }
    const axis = buildAxis(times, outside, options(1552))
    expect(axis.gap).toBeNull()
    expect(axis.ticks.at(-1)).toBeCloseTo(1536, 6)
  })
})

describe('spread', () => {
  it('leaves markers that do not touch where they are', () => {
    expect(spread([20, 100, 300], 24, 0, 400)).toEqual([20, 100, 300])
  })

  it('pushes crowded markers apart around their middle, keeping their order', () => {
    const xs = spread([100, 117, 137], 24, 0, 400)
    expect(xs).toEqual([94, 118, 142])
  })

  it('keeps markers inside the axis', () => {
    expect(spread([2, 6], 24, 10, 400)).toEqual([10, 34])
    expect(spread([396, 399], 24, 0, 400)).toEqual([376, 400])
  })
})

describe('nearestIndex', () => {
  it('finds the tick nearest to a pointer', () => {
    expect(nearestIndex([10, 20, 40], 33)).toBe(2)
    expect(nearestIndex([10, 20, 40], 14)).toBe(0)
    expect(nearestIndex([], 14)).toBe(0)
  })
})

describe('tintsAllKinds', () => {
  it('keeps up to four kind colours, counting each colour once and neutral discs not at all', () => {
    expect(tintsAllKinds(['snow', 'forest', 'forest', 'fields', 'built', null])).toBe(true)
    expect(tintsAllKinds(['snow', 'forest', 'fields', 'built', 'water'])).toBe(false)
    expect(tintsAllKinds([])).toBe(true)
  })
})
