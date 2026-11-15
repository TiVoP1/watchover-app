import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { openPlace, primaryOf, runPrimary } from '#web/panel/primary.ts'
import { useStore } from '#web/state/store.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/**/*.json',
    '/public/data/mexico-city/*.json',
    '/public/data/world-hayli-gubbi/*.json',
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

const state = () => useStore.getState()
const primary = () => primaryOf(state())

beforeAll(() => {
  vi.stubGlobal('fetch', serve)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  useStore.setState(initial, true)
  await state().open('stalowa-wola')
})

describe('the one bright button', () => {
  it('opens the place from the globe, then plays, pauses and resumes the year', () => {
    expect(primary()).toEqual({
      kind: 'open',
      label: 'Open Stalowa Wola',
      icon: 'map-pin-area',
      enabled: true,
    })
    runPrimary(primary().kind)
    expect(state().panel).toBe('rest')
    expect(primary().label).toBe('Play the year')
    runPrimary(primary().kind)
    expect(state().playing).toBe(true)
    expect(primary().label).toBe('Pause')
    runPrimary(primary().kind)
    expect(primary().label).toBe('Resume')
  })

  it('keeps Play the year bright on the Card and closes a tool first', () => {
    state().enter()
    const place = state().place
    const [first] = place.status === 'ready' ? place.story.changes : []
    state().openItem(first?.id ?? null)
    expect(state().panel).toBe('story')
    expect(primary().kind).toBe('play')
    state().setTool('clouds')
    expect(primary()).toMatchObject({ kind: 'close', label: 'Close' })
    runPrimary(primary().kind)
    expect(state().tool).toBe('none')
    expect(state().panel).toBe('story')
  })

  it('offers Resume on a Card opened from a Play stop and continues there', () => {
    state().enter()
    runPrimary(primary().kind)
    const place = state().place
    const forest = place.status === 'ready' ? place.story.chapters[1] : undefined
    if (forest === undefined) throw new Error('forest')
    state().playAt({ frame: forest.frame, chapter: forest.n, gap: false })
    state().openItem(forest.id)
    expect(primary()).toMatchObject({ kind: 'resume', label: 'Resume', enabled: true })
    runPrimary(primary().kind)
    expect(state().playing).toBe(true)
    expect(state().frame).toBe(forest.frame)
    expect(primary().kind).toBe('pause')
  })

  it('leads from the recap to the building in Business', () => {
    state().enter()
    state().finishPlay()
    expect(primary()).toMatchObject({
      kind: 'business',
      label: 'See which buildings move with heat',
    })
    runPrimary(primary().kind)
    expect(state().mode).toBe('business')
    expect(state().selectedObject).toBe('way/359317018')
    expect(primary().kind).toBe('play')
  })

  it('shows the change instead of playing passes that cover only weeks', async () => {
    await openPlace('mexico-city')
    expect(state().panel).toBe('rest')
    expect(primary()).toMatchObject({ kind: 'show', label: 'Show the change' })
  })

  it('shows the change of a place with few radar frames, then the next one', async () => {
    await openPlace('world-hayli-gubbi')
    expect(primary()).toMatchObject({ kind: 'show', label: 'Show the change' })
    runPrimary(primary().kind)
    expect(state().panel).toBe('story')
    const first = state().item
    expect(primary()).toMatchObject({ kind: 'next', label: 'Next change' })
    runPrimary(primary().kind)
    expect(state().item).not.toBe(first)
    expect(state().panel).toBe('story')
  })

  it('leads back from the only change of a place with few radar frames', async () => {
    await openPlace('world-hayli-gubbi')
    const place = state().place
    if (place.status !== 'ready') throw new Error('Hayli Gubbi loads')
    const [first] = place.story.chapters
    useStore.setState({
      place: { ...place, story: { ...place.story, chapters: first === undefined ? [] : [first] } },
    })
    runPrimary(primary().kind)
    expect(primary()).toMatchObject({ kind: 'leave', label: 'Back to all changes' })
    runPrimary(primary().kind)
    expect(state().panel).toBe('rest')
  })

  it('suggests Stalowa Wola on the globe even when another place was loaded last', async () => {
    await state().open('mexico-city')
    expect(state().panel).toBe('orbit')
    expect(primary()).toMatchObject({ kind: 'open', label: 'Open Stalowa Wola', enabled: true })
    const landed = new Promise<void>((resolve) => {
      const stop = useStore.subscribe((s) => {
        if (s.panel !== 'rest') return
        stop()
        resolve()
      })
    })
    runPrimary(primary().kind)
    await landed
    const place = state().place
    expect(place.status === 'ready' ? place.data.slug : null).toBe('stalowa-wola')
  })

  it('leads Business from a place without buildings to the Stalowa Wola buildings', async () => {
    await openPlace('world-hayli-gubbi')
    state().setMode('business')
    expect(primary()).toMatchObject({ kind: 'story-place', label: 'Open Stalowa Wola' })
    const landed = new Promise<void>((resolve) => {
      const stop = useStore.subscribe((s) => {
        if (s.panel !== 'rest' || s.place.status !== 'ready') return
        stop()
        resolve()
      })
    })
    runPrimary(primary().kind)
    await landed
    const place = state().place
    expect(place.status === 'ready' ? place.data.slug : null).toBe('stalowa-wola')
    expect(state().mode).toBe('business')
    expect(primary().kind).toBe('play')
  })

  it('waits disabled while the place loads', () => {
    useStore.setState({ place: { status: 'loading', slug: 'stalowa-wola' } })
    expect(primary()).toMatchObject({ kind: 'open', enabled: false })
  })
})
