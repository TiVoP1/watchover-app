import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '#web/state/store.ts'
import { applyUrl, landsDirectly, parseUrl, searchFor } from '#web/state/url.ts'

const files = import.meta.glob<unknown>('/public/data/stalowa-wola/**/*.json', {
  eager: true,
  import: 'default',
})

const initial = useStore.getState()
const state = () => useStore.getState()

beforeAll(() => {
  vi.stubGlobal('fetch', (url: string) => {
    const body = files[`/public${url}`]
    return Promise.resolve(
      body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
    )
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  useStore.setState(initial, true)
  await state().open('stalowa-wola')
})

describe('parseUrl', () => {
  it('opens Stalowa Wola on the globe by default', () => {
    const url = parseUrl('')
    expect(url.place).toBe('stalowa-wola')
    expect(landsDirectly(url)).toBe(false)
    expect(landsDirectly(parseUrl('?dive=1'))).toBe(false)
  })

  it('opens only a listed place, Stalowa Wola otherwise', () => {
    expect(parseUrl('?place=mexico-city').place).toBe('mexico-city')
    expect(parseUrl('?place=bengal').place).toBe('stalowa-wola')
    expect(parseUrl('?place=../x').place).toBe('stalowa-wola')
  })

  it('reads the film links', () => {
    expect(parseUrl('?dive=1').dive).toBe(true)
    expect(parseUrl('?chapter=3').chapter).toBe(3)
    expect(parseUrl('?tool=sharpen').tool).toBe('sharpen')
    expect(parseUrl('?mode=business&object=way/359422657')).toMatchObject({
      mode: 'business',
      object: 'way/359422657',
    })
  })

  it('ignores values it does not know', () => {
    expect(parseUrl('?tool=compare').tool).toBeNull()
    expect(parseUrl('?mode=projector').mode).toBeNull()
    expect(parseUrl('?chapter=two&frame=-3')).toMatchObject({ chapter: null, frame: null })
  })
})

describe('applyUrl', () => {
  it('stays on the globe and remembers to dive by itself', () => {
    applyUrl(parseUrl('?dive=1'))
    expect(state().panel).toBe('orbit')
    expect(state().autoDive).toBe(true)
  })

  it('freezes a Play stop with the inset', () => {
    applyUrl(parseUrl('?chapter=2'))
    expect(state()).toMatchObject({ panel: 'rest', chapter: 2, paused: true, playing: false })
  })

  it('opens the card of a chapter with its clouds', () => {
    applyUrl(parseUrl('?card=3&tool=clouds'))
    expect(state()).toMatchObject({ panel: 'story', tool: 'clouds' })
    const place = state().place
    if (place.status !== 'ready') throw new Error('place')
    expect(state().item).toBe(place.story.chapters[2]?.id)
  })

  it('lands in Business on the outlier', () => {
    applyUrl(parseUrl('?mode=business&object=way/359422657'))
    expect(state()).toMatchObject({
      panel: 'rest',
      mode: 'business',
      selectedObject: 'way/359422657',
    })
  })

  it('lands in Sharpen', () => {
    applyUrl(parseUrl('?tool=sharpen'))
    expect(state()).toMatchObject({ panel: 'rest', tool: 'sharpen' })
  })
})

describe('searchFor', () => {
  it('writes only the place while the globe waits', () => {
    expect(searchFor(state())).toBe('place=stalowa-wola')
  })

  it('writes what brings the same view back', () => {
    applyUrl(parseUrl('?card=3'))
    expect(parseUrl(`?${searchFor(state())}`)).toMatchObject({ card: '3', frame: state().frame })
    applyUrl(parseUrl('?chapter=4'))
    expect(parseUrl(`?${searchFor(state())}`)).toMatchObject({ chapter: 4, card: null })
  })

  it('brings the recap back from a link', () => {
    state().enter()
    state().finishPlay()
    const search = searchFor(state())
    expect(parseUrl(`?${search}`).recap).toBe(true)
    useStore.setState({ panel: 'orbit' })
    applyUrl(parseUrl(`?${search}`))
    expect(state()).toMatchObject({ panel: 'recap', mode: 'people', playing: false })
  })
})
