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
import { EN } from '#web/i18n/en.ts'
import { buildStory, type Chapter } from '#web/story/chapters.ts'
import {
  becauseText,
  cardFactsText,
  cardTitle,
  dateText,
  factsText,
  itemSentence,
  itemTitle,
  lookSentence,
  metaText,
  missingDays,
  monthSpanText,
  notClaimedText,
  pinText,
  recapLines,
  sourceLines,
  sourceTermText,
  spanText,
  whereText,
} from '#web/story/story-text.ts'

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

const ZONE = 'Europe/Warsaw'
const SCALE = data.nullCheck?.error_inflation ?? 1
const story = buildStory(data)
const latest = data.radar?.frames.at(-1)?.time ?? ''
const plain = (text: string | null) => text?.replaceAll(' ', ' ') ?? null
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

function chapter(n: number): Chapter {
  const found = story.chapters.find((c) => c.n === n)
  if (found === undefined) throw new Error(`chapter ${String(n)}`)
  return found
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'function') return [String(value)]
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings)
  return []
}

describe('rows of the place', () => {
  it('names each chapter with area, place, date and confidence in one word', () => {
    expect(story.chapters.map((c) => [itemTitle(c), plain(factsText(c, ZONE, latest))])).toEqual([
      ['Forest froze', 'about half of the view, 25 Dec 2025, clear'],
      ['Forest gone', '4.1 ha, 6 km NW, 10 Aug, clear'],
      ['Forest gone', '3.5 ha, 10 km S, 15 Sept, clear'],
      ['Fields changed', '20 ha, 16 km SE, 9 Oct, likely'],
      ['Ground reworked', '2.2 ha, in the town centre, 14 Oct, clear'],
      ['Building', '6.4 ha, 3 km S, 20 Oct, clear'],
    ])
  })

  it('names a pin for a screen reader by its title, area and place', () => {
    expect(plain(pinText(chapter(2)))).toBe('Forest gone, 4.1 ha, 6 km north-west of the centre')
    expect(plain(pinText(chapter(3)))).toBe('Forest gone, 3.5 ha, 10 km south of the centre')
  })

  it('keeps every change sentence within twelve words', () => {
    for (const item of [...story.chapters, ...story.secondary]) {
      expect(words(itemSentence(item))).toBeLessThanOrEqual(12)
    }
  })

  it('gives the reason in the sentence, through clouds where the inset shows the photo', () => {
    expect(plain(itemSentence(chapter(2)))).toBe(
      'Trees stopped bouncing the radar back here: 4.1 ha gone.',
    )
    expect(plain(itemSentence(chapter(3)))).toBe(
      'Through clouds: trees stopped bouncing the radar back here, 3.5 ha gone.',
    )
    expect(plain(itemSentence(chapter(4)))).toBe(
      'Fields bounced the radar differently: 20 ha, as when crops come off.',
    )
    expect(plain(lookSentence(chapter(2), ZONE, latest))).toBe('4.1 ha of forest is gone here.')
    expect(plain(lookSentence(chapter(5), ZONE, latest))).toBe(
      '2.2 ha of ground was reworked here.',
    )
  })
})

describe('the Card', () => {
  it('tells the frozen morning without hectares, with the air temperature as an estimate', () => {
    const frost = chapter(1)
    expect(cardTitle(frost, ZONE)).toBe(
      '25 Dec 2025, before dawn: the forest froze, the town did not.',
    )
    expect(plain(cardFactsText(frost, ZONE, latest))).toBe('clear')
    expect(plain(cardFactsText(chapter(6), ZONE, latest))).toBe('6.4 ha, clear')
    expect(plain(becauseText(frost, ZONE))).toBe(
      'Frozen wood bounces the radar back weakly, so the forest dimmed over about half of the view while buildings stayed the same. Air was about −9 °C (NASA POWER estimate). Frozen, not cut.',
    )
  })

  it('counts the visits that stayed low for a forest patch', () => {
    expect(becauseText(chapter(2), ZONE)).toBe(
      'Standing trees bounce the radar back, bare ground does not. Here the bounce dropped sharply and stayed low on all 26 visits since.',
    )
    expect(notClaimedText(chapter(2))).toBe(
      'Cutting or storm damage; we see the trees are gone, not why.',
    )
  })

  it('says the fields changed between the two passes drawn, never harvested', () => {
    const fields = chapter(4)
    expect(plain(lookSentence(fields, ZONE, latest))).toBe(
      '20 ha of fields changed here between 27 Sept and 9 Oct.',
    )
    expect(becauseText(fields, ZONE)).toBe(
      'The fields bounced the radar back differently after 9 Oct, as happens when a crop comes off. The next visit showed the same.',
    )
    expect(becauseText(fields, ZONE)).not.toMatch(/harvest/i)
  })

  it('dates the ground rework by its pair of passes', () => {
    expect(becauseText(chapter(5), ZONE)).toBe(
      'Between 2 Oct and 14 Oct this ground stopped matching its usual radar pattern. Digging, paving or building do that; radar cannot tell which.',
    )
    expect(plain(sourceTermText(chapter(5), SCALE))).toMatch(/^Coherence 0\.\d\d usually, 0\.\d\d/)
  })

  it('tells the building from the evening orbit only, in millimetres moved', () => {
    const heat = chapter(6)
    expect(plain(itemSentence(heat))).toBe('Warm days move this building 4 to 5 mm.')
    expect(plain(becauseText(heat, ZONE))).toBe(
      'Across the 16 °C range of evening air temperatures it moves 4 to 5 mm towards the satellite. No patch of open ground nearby moved with heat this clearly.',
    )
    const meta = plain(metaText(heat, SCALE)) ?? ''
    expect(meta).toMatch(/^Evening orbit: \+0\.30 ± 0\.07 mm per °C over 9 passes\./)
    expect(meta).toContain('one orbit cannot tell up from sideways')
    expect(meta).toContain('NASA POWER estimate')
    for (const text of [itemSentence(heat), becauseText(heat, ZONE), meta]) {
      expect(text).not.toMatch(/lift|taller|two orbits|\b(rise|rises|sink|sinks)\b/i)
    }
  })

  it('traces every change to the passes drawn, in UTC, under Source only', () => {
    const lines = sourceLines(chapter(2)).map((l) => l.pass)
    expect(lines).toEqual([
      'NISAR GCOV, 17 Jul 2026, 03:21 UTC, track 129 ascending',
      'NISAR GCOV, 10 Aug 2026, 03:21 UTC, track 129 ascending',
    ])
    expect(sourceLines(chapter(6))).toHaveLength(9)
    expect(plain(sourceTermText(chapter(2), SCALE))).toMatch(/^HV backscatter −4\.7 dB, from /)
    expect(sourceTermText(chapter(6), SCALE)).toBe('Errors widened 1.2x after testing open ground.')
    expect(sourceTermText(chapter(6), 1)).toBeNull()
  })
})

describe('recap and spans', () => {
  it('counts the changes by kind, one number per idea', () => {
    expect(recapLines(story).map((l) => l.text)).toEqual([
      '2 patches of forest gone',
      '1 field change',
      '1 ground rework',
      '1 frozen morning',
    ])
  })

  it('names the year once for a span inside one year', () => {
    const gap = story.gap
    if (gap === null) throw new Error('gap')
    expect(spanText(gap.from, gap.to, ZONE)).toEqual({ from: '18 Jan', to: '17 Jun 2026' })
    expect(monthSpanText('2026-06-28T00:00:00Z', '2026-08-15T00:00:00Z', ZONE)).toEqual({
      from: 'Jun',
      to: 'Aug 2026',
    })
    expect(dateText('2025-12-25T03:21:00Z', ZONE, latest)).toBe('25 Dec 2025')
    expect(dateText('2026-08-10T03:21:00Z', ZONE, latest)).toBe('10 Aug')
  })

  it('names the days without public data, inside the two passes that bound the gap', () => {
    const gap = story.gap
    if (gap === null) throw new Error('gap')
    const missing = missingDays(gap)
    expect(spanText(missing.from, missing.to, ZONE)).toEqual({ from: '19 Jan', to: '16 Jun 2026' })
  })

  it('says where a change is in plain words', () => {
    expect(whereText({ kind: 'centre' })).toBe('in the town centre')
    expect(plain(whereText({ kind: 'away', km: 6, toward: 'north-west' }))).toBe(
      '6 km north-west of the centre',
    )
    expect(whereText({ kind: 'view', share: 0.53 })).toBe('about half of the view')
  })
})

describe('dictionary', () => {
  it('has no em or en dashes', () => {
    for (const text of strings(EN)) {
      expect(text).not.toMatch(/[\u2013\u2014]/u)
    }
  })
})
