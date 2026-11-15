import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dataUrl,
  eventPairs,
  isGround,
  isNullCheck,
  isPlaceStory,
  isPlayMeta,
  isStripCuts,
  loadPlace,
} from '#web/data/load.ts'
import type { MeasuredPair } from '#web/data/types.ts'
import { PLACE_FILES, PLACES } from '#web/places.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/**/*.json',
    '/public/data/mexico-city/*.json',
    '/public/data/*/story.json',
    '/public/data/world-*/{catalog,radar,event}.json',
  ],
  { eager: true, import: 'default' },
)

const shipped = import.meta.glob<string>(
  [
    '/public/data/*/{clouds,weather,events,radar-play,story,ground,event}.json',
    '/public/data/*/insar/{insar,objects,null_check}.json',
    '/public/data/*/insar/objects.geojson',
  ],
  { query: '?url', import: 'default', eager: true },
)

const WHOLE_PLACE = /\/(catalog|radar)\.json$/

const file = (path: string): unknown => files[`/public/data/${path}`]

function serve(url: string): Promise<Response> {
  const body = files[`/public${url}`]
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('story, ground clock and light frame files', () => {
  it('accepts the story of every place shown and rejects a chapter without its images', () => {
    for (const { slug } of PLACES.slice(1))
      expect(isPlaceStory(file(`${slug}/story.json`))).toBe(true)
    const story = file('mexico-city/story.json')
    if (!isPlaceStory(story)) throw new Error('Mexico City story')
    expect(isPlaceStory({ ...story, chapters: [{ id: 'x', kind: 'ground' }] })).toBe(false)
  })

  it('accepts the Mexico City ground clock and rejects a broken one', () => {
    const ground = file('mexico-city/ground.json')
    expect(isGround(ground)).toBe(true)
    expect(isGround({ ...(ground as object), map: { path: 'x' } })).toBe(false)
    expect(isGround({ ...(ground as object), direction: 'NORTH' })).toBe(false)
    expect(isGround(null)).toBe(false)
  })

  it('accepts the light frames of Stalowa Wola and refuses a manifest without sizes', () => {
    const light = file('stalowa-wola/radar-play.json')
    expect(isPlayMeta(light)).toBe(true)
    expect(isPlayMeta({ ...(light as object), out_px: 'wide' })).toBe(false)
    expect(isPlayMeta({ frames: [] })).toBe(false)
  })
})

describe('event files', () => {
  const brief = (p: MeasuredPair) =>
    `${p.role} ${p.product} ${String(p.track)}${p.direction[0] ?? ''} ${p.from.slice(0, 10)} ${p.to.slice(0, 10)}`

  it('reads the volcano looks and interferograms with the pixel of the maps drawn from them', () => {
    const pairs = eventPairs(file('world-hayli-gubbi/event.json'))
    expect(pairs.map(brief)).toEqual([
      'event GCOV 172A 2025-11-22 2025-12-04',
      'event GCOV 165D 2025-11-21 2025-12-03',
      'event GUNW 165D 2025-11-21 2025-12-03',
      'event GUNW 172A 2025-11-22 2025-12-04',
      'control GUNW 165D 2025-11-09 2025-11-21',
      'control GUNW 172A 2025-11-10 2025-11-22',
    ])
    expect(pairs.find((p) => p.image === 'event/fringes-172a-co.webp')?.pixelM).toBe(20)
  })

  it('reads the earthquake interferograms with the line-of-sight maps of the co-seismic pairs', () => {
    const pairs = eventPairs(file('world-venezuela-quake/event.json'))
    expect(pairs.map(brief)).toEqual([
      'event GUNW 61A 2026-06-18 2026-06-30',
      'control GUNW 61A 2026-06-06 2026-06-18',
      'event GUNW 126D 2026-06-22 2026-07-04',
      'control GUNW 126D 2026-06-10 2026-06-22',
    ])
    expect(pairs[0]).toMatchObject({ image: 'gunw/los-20260618-20260630-61A.webp', pixelM: 80 })
    expect(pairs[1]).toMatchObject({ image: null, pixelM: null })
  })

  it('reads the flood as one pair of looks with its water mask', () => {
    const pairs = eventPairs(file('world-mozambique-flood/event.json'))
    expect(pairs.map(brief)).toEqual(['event GCOV 114A 2025-12-24 2026-01-17'])
    expect(pairs[0]?.scenes).toHaveLength(2)
    expect(pairs[0]?.pixelM).toBe(10)
  })

  it('refuses an event file of an unknown shape', () => {
    expect(() => eventPairs({ claim: 'x' })).toThrow(/event\.json/)
  })
})

describe('open-ground test file', () => {
  it('accepts the file from the pipeline', () => {
    const value = file('stalowa-wola/insar/null_check.json')
    expect(isNullCheck(value)).toBe(true)
    if (!isNullCheck(value)) return
    expect(value.objects.filter((o) => o.label === 'beats_all').map((o) => o.osm)).toEqual([
      'way/359317018',
    ])
  })

  it('rejects an object with an unknown label', () => {
    const value = file('stalowa-wola/insar/null_check.json')
    if (!isNullCheck(value)) throw new Error('null check')
    const objects = value.objects.map((o, i) => (i === 0 ? { ...o, label: 'stable' } : o))
    expect(isNullCheck({ ...value, objects })).toBe(false)
    expect(isNullCheck(null)).toBe(false)
  })

  it('accepts the strip cuts file', () => {
    expect(isStripCuts(file('stalowa-wola/events/strip_cuts.json'))).toBe(true)
    expect(isStripCuts({ patches: [] })).toBe(false)
  })
})

describe('loadPlace', () => {
  it('loads the open-ground test when the place has it', async () => {
    vi.stubGlobal('fetch', serve)
    const data = await loadPlace('stalowa-wola')
    expect(data.nullCheck?.objects).toHaveLength(145)
    expect(data.events?.events.length).toBeGreaterThan(0)
  })

  it('gives null for the files a place does not have', async () => {
    vi.stubGlobal('fetch', serve)
    const data = await loadPlace('mexico-city')
    expect(data.nullCheck).toBeNull()
    expect(data.objects).toBeNull()
    expect(data.eventPairs).toBeNull()
    expect(data.radar?.frames.length).toBeGreaterThan(0)
  })

  it('loads the measured pairs of a world event', async () => {
    vi.stubGlobal('fetch', serve)
    const data = await loadPlace('world-venezuela-quake')
    expect(data.eventPairs).toHaveLength(4)
  })

  it('lists exactly the optional files each place ships', () => {
    for (const { slug, files: listed } of PLACES) {
      const present = PLACE_FILES.filter((file) => `/public${dataUrl(slug, file)}` in shipped)
      expect(new Set(listed), slug).toEqual(new Set(present))
    }
  })

  it('asks only for the files a place ships', async () => {
    const asked: string[] = []
    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url)
      return serve(url)
    })
    for (const { slug, files: listed } of PLACES) {
      asked.length = 0
      await loadPlace(slug)
      const optional = asked.filter((url) => !WHOLE_PLACE.test(url))
      expect(new Set(optional), slug).toEqual(new Set(listed.map((file) => dataUrl(slug, file))))
    }
  })
})
