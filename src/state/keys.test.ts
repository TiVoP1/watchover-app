import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type KeyPress, pressKey } from '#web/state/keys.ts'
import { useStore } from '#web/state/store.ts'

const files = import.meta.glob<unknown>(['/public/data/stalowa-wola/**/*.json'], {
  eager: true,
  import: 'default',
})

const initial = useStore.getState()

function serve(url: string): Promise<Response> {
  const body = files[`/public${url}`]
  return Promise.resolve(
    body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
  )
}

const state = () => useStore.getState()

const press = (key: string, tag = 'BODY'): KeyPress => ({
  key,
  repeat: false,
  modified: false,
  target: { tag, range: false, slider: false },
})

function cardFromStop(n: number) {
  const place = state().place
  const chapter = place.status === 'ready' ? place.story.chapters[n - 1] : undefined
  if (chapter === undefined) throw new Error(`chapter ${String(n)}`)
  state().setPlaying(true)
  state().playAt({ frame: chapter.frame, chapter: chapter.n, gap: false })
  state().openItem(chapter.id)
  return chapter
}

beforeAll(() => {
  vi.stubGlobal('fetch', serve)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  useStore.setState(initial, true)
  await state().open('stalowa-wola')
  state().enter()
})

describe('keys', () => {
  it('Space on a Card opened from a Play stop resumes Play there', () => {
    const forest = cardFromStop(2)
    expect(pressKey(press(' '))).toBe(true)
    expect(state().playing).toBe(true)
    expect(state().panel).toBe('rest')
    expect(state().frame).toBe(forest.frame)
  })

  it('Space on a Card opened at rest plays the year from the first pass', () => {
    const place = state().place
    const fields = place.status === 'ready' ? place.story.chapters[3] : undefined
    state().openItem(fields?.id ?? null)
    expect(pressKey(press(' '))).toBe(true)
    expect(state().playing).toBe(true)
    expect(state().frame).toBe(0)
  })

  it('leaves Space to a focused button', () => {
    cardFromStop(2)
    expect(pressKey(press(' ', 'BUTTON'))).toBe(false)
    expect(state().playing).toBe(false)
    expect(state().panel).toBe('story')
  })

  it('Escape on a Card opened from a Play stop goes back to that stop', () => {
    const forest = cardFromStop(2)
    expect(pressKey(press('Escape'))).toBe(false)
    expect(state().panel).toBe('rest')
    expect(state().paused).toBe(true)
    expect(state().chapter).toBe(forest.n)
  })
})
