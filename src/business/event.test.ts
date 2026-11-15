import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activeEvent,
  businessKind,
  businessOverlay,
  eventItems,
  eventPlate,
  eventWhy,
} from '#web/business/event.ts'
import { restSentence } from '#web/business/sentence.ts'
import { useStore } from '#web/state/store.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/**/*.json',
    '/public/data/mexico-city/*.json',
    '/public/data/world-hayli-gubbi/*.json',
    '/public/data/world-venezuela-quake/*.json',
    '/public/data/world-mozambique-flood/*.json',
  ],
  { eager: true, import: 'default' },
)

const initial = useStore.getState()

function serve(url: string): Promise<Response> {
  const body = files[`/public${url}`]
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  )
}

const plain = (text: string | undefined) => text?.replaceAll(' ', ' ')

async function ready(slug: string) {
  await useStore.getState().open(slug)
  const place = useStore.getState().place
  if (place.status !== 'ready') throw new Error(`${slug} loads`)
  return place
}

beforeAll(() => {
  vi.stubGlobal('fetch', serve)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  useStore.setState(initial, true)
})

describe('Business in every place', () => {
  it.each([
    ['stalowa-wola', 'buildings'],
    ['mexico-city', 'ground'],
    ['world-hayli-gubbi', 'event'],
    ['world-venezuela-quake', 'event'],
    ['world-mozambique-flood', 'event'],
  ])('%s shows %s', async (slug, kind) => {
    const { data, story } = await ready(slug)
    expect(businessKind(data, story)).toBe(kind)
    expect(restSentence(data)).not.toBe('No building series here yet.')
    expect(restSentence(data).split(/\s+/).length).toBeLessThanOrEqual(12)
  })

  it('keeps the La Guaira range relative to central Caracas, as an estimate', async () => {
    const { data, story } = await ready('world-venezuela-quake')
    const [coast] = eventItems(story)
    expect(plain(coast?.told.sentence)).toBe(
      'The coast moved about 50-80 cm west relative to central Caracas.',
    )
    expect(coast?.flags.estimate).toBe(true)
    expect(plain(eventPlate(data, story, null, story.restFrame) ?? undefined)).toBe(
      'change map: NISAR GUNW, 18 Jun 2026 to 30 Jun 2026, 80 m',
    )
    expect(businessOverlay(data, story, null)?.url).toMatch(/los-20260618-20260630-61A\.webp$/)
  })

  it('shows the Hayli Gubbi deposits first and the summit sinking on demand', async () => {
    const { data, story } = await ready('world-hayli-gubbi')
    const items = eventItems(story)
    const first = activeEvent(items, null)
    expect(plain(first?.told.key)).toBe('8.2 km²')
    expect(businessOverlay(data, story, null)?.url).toMatch(/change-hh-172a\.webp$/)
    const sinking = activeEvent(items, 'ground-summit-sinking')
    expect(plain(sinking?.told.sentence)).toBe('The summit area of Erta Ale sank by up to 26 cm.')
    expect(sinking?.flags.estimate).toBe(true)
    expect(businessOverlay(data, story, 'ground-summit-sinking')?.url).toMatch(
      /fringes-172a-co\.webp$/,
    )
  })

  it('labels the Chokwe flood extent as early data and an estimate', async () => {
    const { story } = await ready('world-mozambique-flood')
    const [flood] = eventItems(story)
    expect(plain(flood?.told.sentence)).toBe('About 150 km² of land newly under open water.')
    expect(flood?.flags).toEqual({ early: true, estimate: true })
    expect(flood?.told.businessBecause).toBe(flood?.told.because)
  })

  it('names the overlay track on the plate only when the radar picture comes from another one', async () => {
    const { data, story } = await ready('world-hayli-gubbi')
    const frames = data.radar?.frames ?? []
    const same = frames.findIndex((f) => f.track === 172)
    const other = frames.findIndex((f) => f.track !== 172)
    expect(plain(eventPlate(data, story, null, same) ?? undefined)).toBe(
      'change map: NISAR GCOV, 22 Nov 2025 to 4 Dec 2025',
    )
    if (other !== -1) {
      expect(eventPlate(data, story, null, other)).toMatch(/, track 172 ascending$/)
    }
  })

  it('never says in Business that two orbits agree, and gives every change a business line', async () => {
    for (const slug of ['world-hayli-gubbi', 'world-venezuela-quake', 'world-mozambique-flood']) {
      const { story } = await ready(slug)
      for (const item of eventItems(story)) {
        expect(item.told.businessBecause).not.toMatch(/orbits[^.]*agree/i)
        expect(item.told.businessBecause).not.toMatch(/\(0\s?km²\)/)
        expect(eventWhy(item)).toMatch(/^For owners and insurers: /)
      }
    }
  })

  it('keeps the buildings and the ground clock off the event overlay and plate', async () => {
    const sw = await ready('stalowa-wola')
    expect(businessOverlay(sw.data, sw.story, null)).toBeNull()
    expect(eventPlate(sw.data, sw.story, null, sw.story.restFrame)).toBeNull()
    const mexico = await ready('mexico-city')
    expect(businessOverlay(mexico.data, mexico.story, null)?.url).toMatch(/los_total\.webp$/)
    expect(eventPlate(mexico.data, mexico.story, null, mexico.story.restFrame)).toBeNull()
  })
})
