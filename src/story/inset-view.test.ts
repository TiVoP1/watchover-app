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
import { buildStory } from '#web/story/chapters.ts'
import { type InsetState, insetFacts, insetHeader, insetView } from '#web/story/inset-view.ts'
import { factsText, itemSentence } from '#web/story/story-text.ts'

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
const story = buildStory(data)
const ZONE = 'Europe/Warsaw'
const PLAYING: InsetState = {
  mode: 'people',
  panel: 'rest',
  playing: true,
  paused: false,
  tool: 'none',
  chapter: 2,
}
const MAX_WORDS = 12

describe('insetView', () => {
  it('shows the stop of the chapter that Play reached, with the chapter count', () => {
    const view = insetView(PLAYING, story)
    expect(view?.kind).toBe('stop')
    if (view?.kind !== 'stop') return
    expect(view.chapter.n).toBe(2)
    expect(view.total).toBe(6)
  })

  it('stays on a paused stop and hides between stops, on the gap and outside Play', () => {
    expect(insetView({ ...PLAYING, playing: false, paused: true }, story)?.kind).toBe('stop')
    expect(insetView({ ...PLAYING, chapter: null }, story)).toBeNull()
    expect(insetView({ ...PLAYING, playing: false }, story)).toBeNull()
    expect(insetView({ ...PLAYING, panel: 'story' }, story)).toBeNull()
    expect(insetView({ ...PLAYING, panel: 'orbit' }, story)).toBeNull()
  })

  it('never shows in Business, under a tool or before the place is ready', () => {
    expect(insetView({ ...PLAYING, mode: 'business' }, story)).toBeNull()
    expect(insetView({ ...PLAYING, tool: 'clouds' }, story)).toBeNull()
    expect(insetView(PLAYING, null)).toBeNull()
  })

  it('turns into the Business teaser of the story building on the recap', () => {
    const view = insetView({ ...PLAYING, panel: 'recap', playing: false, chapter: null }, story)
    expect(view?.kind).toBe('teaser')
    if (view?.kind !== 'teaser') return
    expect(view.chapter.heat.object.osm).toBe('way/359317018')
    expect(view.chapter.range).toMatchObject({ loMm: 4, hiMm: 5 })
  })

  it('has no teaser without a building that beats open ground', () => {
    const plain = buildStory({ ...data, nullCheck: null })
    expect(insetView({ ...PLAYING, panel: 'recap', playing: false }, plain)).toBeNull()
  })
})

describe('inset text', () => {
  it('reports the place and the local day without breaking the date', () => {
    const forest = story.chapters[1]
    const frost = story.chapters[0]
    if (forest === undefined || frost === undefined) throw new Error('chapters')
    expect(insetHeader('Stalowa Wola', forest, ZONE)).toBe('New at Stalowa Wola, 10 Aug')
    expect(insetHeader('Stalowa Wola', frost, ZONE)).toBe('New at Stalowa Wola, 25 Dec')
  })

  it('heads the building with the span of its evening passes, not the reference pass', () => {
    const building = story.chapters.find((c) => c.kind === 'heat')
    if (building === undefined) throw new Error('building')
    const header = insetHeader('Stalowa Wola', building, ZONE)
    expect(header).toMatch(/^Seen at Stalowa Wola, [A-Z][a-z]+ to Oct$/)
    expect(header).not.toContain('20')
  })

  it('says where and how sure, ending on the confidence word of the panel row', () => {
    const [frost, forest, , fields, rework] = story.chapters
    if (frost === undefined || forest === undefined || fields === undefined) throw new Error('ch')
    const facts = (chapter: typeof frost | undefined) =>
      chapter === undefined ? null : insetFacts(chapter).replaceAll(' ', ' ')
    expect(facts(frost)).toBe('about half of the view, clear')
    expect(facts(forest)).toBe('6 km north-west of the centre, clear')
    expect(facts(fields)).toBe('16 km south-east of the centre, likely')
    expect(facts(rework)).toBe('in the town centre, clear')
    for (const chapter of story.chapters) {
      const row = factsText(chapter, ZONE, chapter.time).split(', ').at(-1)
      expect(insetFacts(chapter).split(', ').at(-1)).toBe(row)
    }
  })

  it('keeps every inset sentence within twelve words', () => {
    for (const chapter of story.chapters) {
      expect(itemSentence(chapter).split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS)
    }
  })
})
