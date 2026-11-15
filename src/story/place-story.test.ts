import { describe, expect, it } from 'vitest'
import { eventPairs, isGround, isPlaceStory } from '#web/data/load.ts'
import type { Catalog, PlaceData, PlaceStory, RadarMeta } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { PLACES } from '#web/places.ts'
import { buildStory, type Chapter, type RadarTile } from '#web/story/chapters.ts'
import {
  isTold,
  nextTold,
  playable,
  type ToldItem,
  toldCardFacts,
  toldChapters,
  toldCount,
  toldFacts,
  toldSummary,
  withTold,
} from '#web/story/place-story.ts'
import { measuredLines } from '#web/story/story-text.ts'
import { tileFaces, tileFinePrint } from '#web/story/tile.ts'
import { formatDate } from '#web/ui/format.ts'

const files = import.meta.glob<unknown>(
  ['/public/data/*/{catalog,radar,story,ground}.json', '/public/data/world-*/event.json'],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null

const TOLD = [
  'mexico-city',
  'world-hayli-gubbi',
  'world-venezuela-quake',
  'world-mozambique-flood',
] as const

const MAX_WORDS = 12
const DASHES = /[\u2013\u2014]/u
const NBSP = '\u00a0'
const UNIT_CODES = new Set(['cm', 'mm', 'km2', 'dB', ...Object.keys(EN.told.counts)])

function storyOf(slug: string): PlaceStory {
  const story = file(`${slug}/story.json`)
  if (!isPlaceStory(story)) throw new Error(`${slug}: story.json has an unexpected shape`)
  return story
}

function place(slug: string): PlaceData {
  const ground = file(`${slug}/ground.json`)
  const event = file(`${slug}/event.json`)
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
    ground: isGround(ground) ? ground : null,
    play: null,
    eventPairs: event === null ? null : eventPairs(event),
    story: file(`${slug}/story.json`) === null ? null : storyOf(slug),
  }
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

const tileOf = (item: Pick<Chapter, 'tile'>): RadarTile => {
  if (item.tile.variant !== 'radar') throw new Error('told tiles are radar tiles')
  return item.tile
}

function toldOf(slug: string, index = 0): ToldItem {
  const chapter = toldChapters(place(slug))[index]
  if (chapter === undefined || !isTold(chapter)) throw new Error(`${slug}: no told chapter`)
  return chapter
}

const plain = (text: string) => text.replaceAll(NBSP, ' ')

describe('toldChapters', () => {
  it('tells every chapter of every other place, numbered in time order', () => {
    for (const slug of TOLD) {
      const chapters = toldChapters(place(slug))
      expect(chapters.length).toBe(storyOf(slug).chapters.length)
      expect(chapters.map((c) => c.n)).toEqual(chapters.map((_, i) => i + 1))
      for (const c of chapters) {
        expect(isTold(c)).toBe(true)
        if (!isTold(c)) continue
        expect(words(c.told.sentence)).toBeLessThanOrEqual(MAX_WORDS)
        const { title, sentence, because, businessBecause, notClaimed } = c.told
        for (const text of [title, sentence, because, businessBecause, notClaimed]) {
          expect(text).not.toMatch(DASHES)
          expect(text.length).toBeGreaterThan(0)
        }
        expect(c.told.caveats.length).toBe(
          storyOf(slug).chapters.find((r) => r.id === c.id)?.caveats.length,
        )
      }
    }
  })

  it('maps the data kinds to glyph kinds, with a neutral one for anything unknown', () => {
    const kinds = (slug: string) => toldChapters(place(slug)).map((c) => c.kind)
    expect(kinds('mexico-city')).toEqual(['ground'])
    expect(kinds('world-hayli-gubbi')).toEqual(['volcano', 'ground'])
    expect(kinds('world-venezuela-quake')).toEqual(['quake'])
    expect(kinds('world-mozambique-flood')).toEqual(['flood'])
    const odd = place('mexico-city')
    const story = storyOf('mexico-city')
    const renamed: PlaceData = {
      ...odd,
      story: { ...story, chapters: story.chapters.map((c) => ({ ...c, kind: 'crops' })) },
    }
    expect(toldChapters(renamed).map((c) => c.kind)).toEqual(['other'])
  })

  it('stops on the radar frame of the chapter date', () => {
    const data = place('mexico-city')
    for (const c of toldChapters(data)) {
      expect(data.radar?.frames[c.frame]?.time).toBe(c.time)
    }
  })

  it('has a dictionary entry for every caveat and unit code of the places shown', () => {
    for (const slug of TOLD) {
      for (const record of storyOf(slug).chapters) {
        for (const code of record.caveats) expect(Object.keys(EN.told.caveats)).toContain(code)
        for (const number of Object.values(record.numbers)) {
          expect(UNIT_CODES.has(number.unit)).toBe(true)
        }
      }
    }
  })

  it('reads the Mexico City numbers and both chart series from the data', () => {
    const [ground] = toldChapters(place('mexico-city'))
    if (ground === undefined || !isTold(ground)) throw new Error('Mexico City has a ground story')
    const record = storyOf('mexico-city').chapters[0]
    const moved = record?.numbers.moved_away?.value
    expect(plain(ground.told.key)).toBe(`${String(moved)} cm`)
    expect(plain(ground.told.range ?? '')).toBe('10 to 22 cm')
    expect(ground.told.chart?.series).toHaveLength(2)
    expect(ground.told.chart?.series[0]?.points.length).toBe(record?.chart?.series[0]?.dates.length)
  })

  it('crops the overlay on its own ground when it covers more than the radar image', () => {
    const [ground] = toldChapters(place('mexico-city'))
    if (ground === undefined) throw new Error('Mexico City has a ground story')
    const tile = tileOf(ground)
    expect(tile.mask).toBe('ground/los_total.webp')
    expect(tile.maskCrop).toBeDefined()
    expect(tile.maskCrop?.w).toBeLessThan(tile.crop.w)
    expect(tile.legend).toBeDefined()
  })

  it('tells the Venezuela coast as the verified range, never a single detail value', () => {
    const coast = toldOf('world-venezuela-quake')
    expect(plain(coast.told.key)).toBe('about 50-80 cm')
    expect(coast.told.range).toBeNull()
    expect(plain(coast.told.sentence)).toBe(
      'The coast moved about 50-80 cm west relative to central Caracas.',
    )
    expect(coast.told.because).toMatch(/ionosphere/)
    for (const text of [coast.told.key, coast.told.sentence, coast.told.because]) {
      expect(text).not.toMatch(/53|62\.8|La Guaira moved/)
    }
  })

  it('says the Venezuela range spans the ionosphere correction, whose top end uses it', () => {
    const { caveats } = toldOf('world-venezuela-quake').told
    expect(caveats).toContain('Range: with and without the ionosphere correction')
    expect(caveats.join(' ')).not.toMatch(/not applied|not corrected for the ionosphere/i)
  })

  it('rounds every number to its uncertainty, as the event claims do', () => {
    const flood = toldOf('world-mozambique-flood')
    expect(plain(flood.told.key)).toBe('150 km²')
    expect(plain(flood.told.range ?? '')).toBe('80 to 180 km²')
    expect(plain(flood.told.sentence)).toBe('About 150 km² of land newly under open water.')
    expect(plain(flood.told.because)).toContain('from −10 dB to −18 dB')
    expect(plain(flood.told.because)).toContain('(150 km²)')
    expect(plain(flood.told.because)).toContain('only 0.6 km²')
    expect(plain(toldOf('world-hayli-gubbi').told.key)).toBe('8.2 km²')
    expect(plain(toldOf('world-hayli-gubbi', 1).told.key)).toBe('26 cm')
    expect(plain(toldOf('mexico-city').told.because)).toContain('about 24 cm of sinking')
  })

  it('rounds the firm hills, a noise level, up to the whole centimetre', () => {
    const within = 'ended within 1 cm of where they started'
    expect(plain(toldOf('mexico-city').told.because)).toContain(within)
    expect(plain(toldSummary(place('mexico-city'))?.long ?? '')).toContain(within)
  })

  it('labels an estimated key number, but not a measured one with an estimate in its text', () => {
    expect(toldOf('world-mozambique-flood').flags.estimate).toBe(true)
    expect(toldOf('world-venezuela-quake').flags.estimate).toBe(true)
    expect(toldOf('world-hayli-gubbi', 1).flags.estimate).toBe(true)
    expect(toldOf('world-hayli-gubbi').flags.estimate).toBe(false)
    expect(toldOf('mexico-city').flags.estimate).toBe(false)
    const zone = 'Africa/Maputo'
    expect(toldFacts(toldOf('world-mozambique-flood'), zone)).toMatch(/, likely, estimate$/)
    expect(toldFacts(toldOf('mexico-city'), zone)).toMatch(/, clear$/)
    expect(toldCardFacts(toldOf('world-mozambique-flood'), zone)).toMatch(/, likely$/)
  })

  it('keeps the row facts to the key, the date and the trust, without the direction', () => {
    expect(plain(toldFacts(toldOf('world-venezuela-quake'), 'America/Caracas'))).toBe(
      'about 50-80 cm, 30 Jun 2026, clear, estimate',
    )
  })

  it('traces every number to the pairs it was measured from, apart from the image drawn', () => {
    const lines = (item: ToldItem) => measuredLines(item).map(plain)
    expect(lines(toldOf('world-venezuela-quake'))).toEqual([
      'Measured: NISAR GUNW, track 61 ascending, 18 Jun to 30 Jun 2026, 09:58 UTC',
      'Measured: NISAR GUNW, track 126 descending, 22 Jun to 4 Jul 2026, 22:54 UTC',
    ])
    expect(lines(toldOf('mexico-city'))).toEqual([
      'Measured: NISAR GUNW, 28 pairs, track 19 ascending, 30 Oct 2025 to 13 Oct 2026, 12:05 UTC',
    ])
    const tracks = (item: ToldItem) =>
      item.told.measured.map((p) => `${p.product} ${String(p.track)} ${p.direction}`)
    expect(tracks(toldOf('world-hayli-gubbi'))).toEqual([
      'GCOV 172 ASCENDING',
      'GCOV 165 DESCENDING',
    ])
    expect(tracks(toldOf('world-hayli-gubbi', 1))).toEqual([
      'GUNW 165 DESCENDING',
      'GUNW 172 ASCENDING',
    ])
    const [flood] = toldOf('world-mozambique-flood').told.measured
    expect(flood).toMatchObject({
      product: 'GCOV',
      track: 114,
      from: '2025-12-24T03:42:31Z',
      to: '2026-01-17T03:42:32Z',
    })
    for (const slug of TOLD) {
      for (const c of toldChapters(place(slug))) {
        if (isTold(c)) expect(c.told.measured.length).toBeGreaterThan(0)
      }
    }
  })

  it('names an opaque change map by its own product, pixel and period', () => {
    const coast = tileOf(toldOf('world-venezuela-quake'))
    expect(coast.map).toEqual({
      product: 'GUNW',
      pixelM: 80,
      from: '2026-06-18T09:58:36Z',
      to: '2026-06-30T09:58:35Z',
    })
    expect(plain(tileFinePrint(coast, 10))).toBe('Change map: NISAR GUNW, 80 m pixels.')
    expect(plain(tileFaces(coast, 'America/Caracas')?.[1].label ?? '')).toBe(
      '18 Jun to 30 Jun 2026',
    )
    const ground = tileOf(toldOf('mexico-city'))
    expect(plain(tileFinePrint(ground, 10))).toBe('Change map: NISAR GUNW, 80 m pixels.')
    const faces = tileFaces(ground, 'America/Mexico_City')
    expect(faces?.map((f) => plain(f.label))).toEqual(['13 Oct', '30 Oct 2025 to 13 Oct 2026'])
    expect(plain(tileFinePrint(tileOf(toldOf('world-hayli-gubbi')), 20))).toBe(
      'Change map: NISAR GCOV, 20 m pixels.',
    )
    expect(plain(tileFinePrint(tileOf(toldOf('world-hayli-gubbi', 1)), 20))).toBe(
      'Change map: NISAR GUNW, 20 m pixels.',
    )
    const flood = tileOf(toldOf('world-mozambique-flood'))
    expect(flood.map).toBeUndefined()
    expect(plain(tileFinePrint(flood, 10))).toContain('10 m pixels')
  })

  it('claims no pixel size for a change map whose source file is missing', () => {
    const [coast] = toldChapters({ ...place('world-venezuela-quake'), eventPairs: null })
    if (coast === undefined || !isTold(coast)) throw new Error('La Guaira has a story')
    expect(tileFinePrint(tileOf(coast), 10)).toBe('Change map: NISAR.')
    expect(coast.told.measured).toEqual([])
  })

  it('credits the sources of the event context next to the NISAR scenes', () => {
    expect(toldOf('world-mozambique-flood').told.attribution).toMatch(/NASA Earth Observatory/)
    expect(toldOf('world-hayli-gubbi').told.attribution).toMatch(/NASA Earth Observatory/)
    expect(toldOf('world-venezuela-quake').told.attribution).toMatch(/USGS/)
  })

  it('shows a whole change map as the after side, and lays a sparse mask over the radar', () => {
    expect(tileOf(toldOf('world-hayli-gubbi')).maskOpaque).toBe(true)
    expect(tileOf(toldOf('world-venezuela-quake')).maskOpaque).toBe(true)
    expect(tileOf(toldOf('world-mozambique-flood')).maskOpaque).toBe(false)
  })

  it('keeps the focus box inside the radar window', () => {
    const data = place('world-venezuela-quake')
    const corners = data.radar?.corners_lonlat ?? []
    const east = Math.max(...corners.map(([lon]) => lon))
    expect(toldOf('world-venezuela-quake').bbox[2]).toBeLessThanOrEqual(east)
  })

  it('treats a change across the whole square as the view, still with a pin spot', () => {
    const [flood] = toldChapters(place('world-mozambique-flood'))
    expect(flood?.where.kind).toBe('view')
    expect(flood?.flags.early).toBe(true)
    if (flood !== undefined) expect(tileOf(flood).outline).toBeNull()
    const [stain] = toldChapters(place('world-hayli-gubbi'))
    expect(stain?.where.kind).toBe('away')
  })
})

describe('withTold', () => {
  it('replaces the empty story of another place and leaves Stalowa Wola alone', () => {
    const mexico = place('mexico-city')
    const story = withTold(buildStory(mexico), mexico)
    expect(story.chapters).toHaveLength(1)
    expect(story.changes).toEqual(story.chapters)
    const plain = buildStory({ ...mexico, story: null })
    expect(withTold(plain, { ...mexico, story: null })).toBe(plain)
  })

  it('rests on the track the first chapter was measured on, the last pass of that track', () => {
    for (const slug of TOLD) {
      const data = place(slug)
      const frames = data.radar?.frames ?? []
      const story = withTold(buildStory(data), data)
      const [first] = story.chapters
      const anchor = first === undefined ? undefined : frames[first.frame]
      expect(story.background).toEqual({ track: anchor?.track, direction: anchor?.direction })
      const rest = frames[story.restFrame]
      expect(rest?.track).toBe(anchor?.track)
      const later = frames.slice(story.restFrame + 1)
      expect(later.some((f) => f.track === anchor?.track)).toBe(false)
    }
  })
})

describe('toldSummary', () => {
  it('gives a row sentence of at most 12 words and a longer panel sentence', () => {
    for (const slug of TOLD) {
      const summary = toldSummary(place(slug))
      expect(summary).not.toBeNull()
      if (summary === null) continue
      expect(words(summary.short)).toBeLessThanOrEqual(MAX_WORDS)
      expect(summary.long.length).toBeGreaterThanOrEqual(summary.short.length)
      expect(summary.long).not.toMatch(DASHES)
    }
  })

  it('dates the summary in the place zone', () => {
    const data = place('world-mozambique-flood')
    const record = data.story?.chapters[0]
    if (record === undefined) throw new Error('Chokwe has a story')
    const summary = toldSummary(data)
    expect(summary?.long).toContain(formatDate(record.after.date, 'Africa/Maputo'))
    expect(summary?.long).toContain(formatDate(record.before.date, 'Africa/Maputo'))
  })

  it('tells the Venezuela summary with the verified range', () => {
    expect(plain(toldSummary(place('world-venezuela-quake'))?.short ?? '')).toBe(
      'The coast moved about 50-80 cm west relative to central Caracas.',
    )
  })
})

describe('toldCount', () => {
  it('counts the told chapters for the globe and the place list', () => {
    expect(toldCount('world-hayli-gubbi', storyOf('world-hayli-gubbi'))).toBe(2)
    expect(toldCount('stalowa-wola', storyOf('mexico-city'))).toBeNull()
  })
})

describe('playable and nextTold', () => {
  it('plays only a year of passes and walks the chapters in order', () => {
    expect(playable(place('stalowa-wola'))).toBe(true)
    expect(playable(place('mexico-city'))).toBe(false)
    expect(playable(place('world-venezuela-quake'))).toBe(false)
    const hayli = place('world-hayli-gubbi')
    const story = withTold(buildStory(hayli), hayli)
    const [first, second] = story.chapters
    expect(nextTold(story, null)?.id).toBe(first?.id)
    expect(nextTold(story, first?.id ?? null)?.id).toBe(second?.id)
    expect(nextTold(story, second?.id ?? null)?.id).toBe(first?.id)
  })
})

describe('places', () => {
  it('puts every globe point on the centre from its catalog', () => {
    for (const p of PLACES) {
      const catalog = file(`${p.slug}/catalog.json`) as Catalog
      expect(p.centre).toEqual([catalog.place.lon, catalog.place.lat])
    }
  })
})
