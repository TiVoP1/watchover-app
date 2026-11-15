import { useEffect } from 'react'
import { PLACES } from '#web/places.ts'
import { type Mode, placeSlug, type StoreState, type Tool, useStore } from '#web/state/store.ts'
import { chapterByNumber } from '#web/story/chapters.ts'

export const DEFAULT_PLACE = 'stalowa-wola'

const TOOLS: readonly Tool[] = ['clouds', 'sharpen']
const MODES: readonly Mode[] = ['people', 'business']
const SLUGS: readonly string[] = PLACES.map((p) => p.slug)
const WHOLE = /^\d+$/
const RECAP = 'recap'

export interface UrlState {
  readonly place: string
  readonly frame: number | null
  readonly mode: Mode | null
  readonly chapter: number | null
  readonly card: string | null
  readonly object: string | null
  readonly tool: Tool | null
  readonly recap: boolean
  readonly dive: boolean
  readonly falseColour: boolean
}

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  allowed.find((v) => v === value) ?? null

const whole = (value: string | null): number | null =>
  value !== null && WHOLE.test(value) ? Number(value) : null

export function parseUrl(search: string): UrlState {
  const params = new URLSearchParams(search)
  return {
    place: pick(params.get('place'), SLUGS) ?? DEFAULT_PLACE,
    frame: whole(params.get('frame')),
    mode: pick(params.get('mode'), MODES),
    chapter: whole(params.get('chapter')),
    card: params.get('card'),
    object: params.get('object'),
    tool: pick(params.get('tool'), TOOLS),
    recap: params.get('view') === RECAP,
    dive: params.get('dive') === '1',
    falseColour: params.get('false') === '1',
  }
}

export const landsDirectly = (url: UrlState): boolean =>
  url.frame !== null ||
  url.mode === 'business' ||
  url.chapter !== null ||
  url.card !== null ||
  url.object !== null ||
  url.tool !== null ||
  url.recap

function cardItem(card: string): string | null {
  const place = useStore.getState().place
  if (place.status !== 'ready') return null
  const n = whole(card)
  return n === null ? card : (chapterByNumber(place.story, n)?.id ?? null)
}

export function applyUrl(url: UrlState): void {
  const s = useStore.getState()
  if (url.dive) s.setAutoDive(true)
  if (landsDirectly(url)) s.enter()
  if (url.mode !== null) s.setMode(url.mode)
  if (url.chapter !== null) s.freezeChapter(url.chapter)
  else if (url.card !== null) s.openItem(cardItem(url.card))
  else if (url.frame !== null) s.setFrame(url.frame)
  if (url.recap) s.showRecap()
  if (url.object !== null) s.select(url.object)
  if (url.falseColour) s.setFalseColour(true)
  if (url.tool !== null) s.setTool(url.tool)
}

function cardParam(s: StoreState): string | null {
  if (s.panel !== 'story' || s.item === null || s.place.status !== 'ready') return null
  const chapter = s.place.story.chapters.find((c) => c.id === s.item)
  return chapter === undefined ? s.item : String(chapter.n)
}

export function searchFor(s: StoreState): string {
  const params = new URLSearchParams()
  const slug = placeSlug(s.place)
  if (slug !== null) params.set('place', slug)
  if (s.mode !== 'people') params.set('mode', s.mode)
  if (s.panel !== 'orbit') {
    params.set('frame', String(s.frame))
    const card = cardParam(s)
    if (card !== null) params.set('card', card)
    if (s.chapter !== null) params.set('chapter', String(s.chapter))
    if (s.tool === 'clouds' || s.tool === 'sharpen') params.set('tool', s.tool)
    if (s.panel === 'recap') params.set('view', RECAP)
  }
  if (s.selectedObject !== null) params.set('object', s.selectedObject)
  if (s.falseColour) params.set('false', '1')
  return params.toString()
}

export function useUrlState(): void {
  const open = useStore((s) => s.open)

  useEffect(() => {
    const url = parseUrl(window.location.search)
    void open(url.place).then(() => {
      applyUrl(url)
    })
  }, [open])

  useEffect(
    () =>
      useStore.subscribe((s) => {
        const search = searchFor(s)
        const next =
          search === '' ? window.location.pathname : `${window.location.pathname}?${search}`
        if (next !== `${window.location.pathname}${window.location.search}`) {
          window.history.replaceState(null, '', next)
        }
      }),
    [],
  )
}
