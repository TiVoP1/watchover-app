import { describe, expect, it } from 'vitest'
import { businessSentence, restSentence } from '#web/business/sentence.ts'
import { isGround, isNullCheck, isPlaceStory } from '#web/data/load.ts'
import type { Catalog, NullCheck, Objects, PlaceData, RadarMeta } from '#web/data/types.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar}.json',
    '/public/data/stalowa-wola/insar/{objects,null_check}.json',
    '/public/data/mexico-city/{catalog,radar,story,ground}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null
const checked = file('stalowa-wola/insar/null_check.json')
const nullCheck: NullCheck | null = isNullCheck(checked) ? checked : null
const radar = file('stalowa-wola/radar.json') as RadarMeta

const data: PlaceData = {
  slug: 'stalowa-wola',
  catalog: file('stalowa-wola/catalog.json') as Catalog,
  radar,
  clouds: null,
  weather: null,
  insar: null,
  objects: file('stalowa-wola/insar/objects.json') as Objects,
  events: null,
  footprints: null,
  nullCheck,
  story: null,
  ground: null,
  play: null,
  eventPairs: null,
}

const mexicoStory = file('mexico-city/story.json')
const mexicoGround = file('mexico-city/ground.json')

const mexico: PlaceData = {
  slug: 'mexico-city',
  catalog: file('mexico-city/catalog.json') as Catalog,
  radar: file('mexico-city/radar.json') as RadarMeta,
  clouds: null,
  weather: null,
  insar: null,
  objects: null,
  events: null,
  footprints: null,
  nullCheck: null,
  play: null,
  eventPairs: null,
  story: isPlaceStory(mexicoStory) ? mexicoStory : null,
  ground: isGround(mexicoGround) ? mexicoGround : null,
}

const ZONE = 'Europe/Warsaw'
const NBSP = ' '

const frameOf = (time: string): number => {
  const index = radar.frames.findIndex((f) => f.time === time)
  if (index === -1) throw new Error(time)
  return index
}

const playing = (frame: number) => businessSentence({ data, frame, playing: true, timeZone: ZONE })

describe('businessSentence at rest', () => {
  it('counts the structures that beat every open-ground patch', () => {
    expect(businessSentence({ data, frame: 0, playing: false, timeZone: ZONE })).toBe(
      '1 of 145 structures moves clearly with heat so far.',
    )
  })

  it('uses the plural verb for more than one structure', () => {
    if (nullCheck === null) throw new Error('no null check')
    const two = nullCheck.objects.map((o, i) => (i < 2 ? { ...o, label: 'beats_all' as const } : o))
    expect(restSentence({ ...data, nullCheck: { ...nullCheck, objects: two } })).toBe(
      '2 of 145 structures move clearly with heat so far.',
    )
  })

  it('makes no count without the open-ground check', () => {
    expect(restSentence({ ...data, nullCheck: null })).toBe(
      'Building motion measured, not yet checked against open ground.',
    )
  })

  it('says plainly that a place without buildings, a ground clock or a story has no series', () => {
    expect(restSentence({ ...data, objects: null })).toBe('No building series here yet.')
    expect(restSentence({ ...mexico, story: null })).toBe('No building series here yet.')
  })

  it('falls back to the story summary of a place without buildings or a ground clock', () => {
    expect(restSentence({ ...mexico, ground: null })).toBe(
      `Nezahualcóyotl moved 19${NBSP}cm away from the radar in 348${NBSP}days.`,
    )
  })

  it('headlines the Mexico City ground clock with numbers from story.json, within 12 words', () => {
    const sentence = restSentence(mexico)
    expect(sentence).toBe(`Nezahualcóyotl moved 19${NBSP}cm away from the radar in 348 days.`)
    expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(12)
  })
})

describe('businessSentence during Play', () => {
  it('names the evening pass and its air temperature in the place time', () => {
    expect(playing(frameOf('2026-07-16T17:43:20Z'))).toBe(
      `16 Jul, 26.9${NBSP}°C at the evening pass`,
    )
  })

  it('holds the last evening pass on a dawn frame, matching the heights drawn', () => {
    expect(playing(frameOf('2026-07-17T03:21:57Z'))).toBe(
      `16 Jul, 26.9${NBSP}°C at the evening pass`,
    )
  })

  it('says there is no building series before the first evening pass', () => {
    expect(playing(0)).toBe('No building series before 22 Jun 2026.')
  })

  it('returns to the rest sentence when Play stops', () => {
    expect(
      businessSentence({
        data,
        frame: frameOf('2026-07-16T17:43:20Z'),
        playing: false,
        timeZone: ZONE,
      }),
    ).toBe('1 of 145 structures moves clearly with heat so far.')
  })

  it('keeps the ground clock headline while Mexico City plays', () => {
    expect(
      businessSentence({ data: mexico, frame: 0, playing: true, timeZone: 'America/Mexico_City' }),
    ).toBe(`Nezahualcóyotl moved 19${NBSP}cm away from the radar in 348 days.`)
  })
})
