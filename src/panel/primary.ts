import { EN } from '#web/i18n/en.ts'
import { STORY_PLACE } from '#web/places.ts'
import { placeSlug, type StoreState, useStore } from '#web/state/store.ts'
import { isTold, nextTold, playable } from '#web/story/place-story.ts'
import type { IconName } from '#web/ui/icon.tsx'

export type PrimaryKind =
  | 'open'
  | 'story-place'
  | 'play'
  | 'pause'
  | 'resume'
  | 'close'
  | 'business'
  | 'show'
  | 'next'
  | 'leave'

export type PrimaryState = Pick<
  StoreState,
  'place' | 'panel' | 'playing' | 'paused' | 'resumeAt' | 'tool' | 'mode' | 'item'
>

export interface Primary {
  readonly kind: PrimaryKind
  readonly label: string
  readonly icon: IconName
  readonly enabled: boolean
}

const ICON: Readonly<Record<PrimaryKind, IconName>> = {
  open: 'map-pin-area',
  'story-place': 'map-pin-area',
  play: 'play',
  pause: 'pause',
  resume: 'play',
  close: 'x',
  business: 'briefcase',
  show: 'caret-right',
  next: 'caret-right',
  leave: 'caret-left',
}

const showsChange = (s: PrimaryState): boolean =>
  s.mode === 'people' &&
  s.place.status === 'ready' &&
  s.place.story.chapters.some(isTold) &&
  !playable(s.place.data)

const nextChapter = (s: PrimaryState): string | null =>
  s.place.status === 'ready' ? (nextTold(s.place.story, s.item)?.id ?? null) : null

function toldKind(s: PrimaryState): PrimaryKind {
  if (s.panel !== 'story' || s.item === null) return 'show'
  return nextChapter(s) === s.item ? 'leave' : 'next'
}

const storiesHere = (s: PrimaryState): boolean =>
  s.place.status !== 'ready' || s.place.story.changes.length > 0

const buildingsHere = (s: PrimaryState): boolean =>
  s.place.status !== 'ready' || s.place.data.objects !== null

const heatObject = (s: Pick<StoreState, 'place'>): string | null => {
  if (s.place.status !== 'ready') return null
  const heat = s.place.story.chapters.find((c) => c.kind === 'heat')
  return heat?.kind === 'heat' ? heat.heat.object.osm : null
}

export function primaryKind(s: PrimaryState): PrimaryKind {
  if (s.tool !== 'none') return 'close'
  if (s.panel === 'orbit') return 'open'
  if (showsChange(s)) return toldKind(s)
  if (s.mode === 'people' && !storiesHere(s)) return 'story-place'
  if (s.mode === 'business' && !buildingsHere(s)) return 'story-place'
  if (s.mode === 'people' && s.panel === 'recap') {
    const objects = s.place.status === 'ready' ? s.place.data.objects : null
    if (objects !== null) return 'business'
  }
  if (s.playing) return 'pause'
  return s.paused || s.resumeAt !== null ? 'resume' : 'play'
}

function label(kind: PrimaryKind): string {
  switch (kind) {
    case 'open':
    case 'story-place':
      return EN.globe.open(STORY_PLACE.label)
    case 'play':
      return EN.panel.play
    case 'pause':
      return EN.panel.pause
    case 'resume':
      return EN.panel.resume
    case 'close':
      return EN.panel.close
    case 'business':
      return EN.recap.business
    case 'show':
      return EN.told.show
    case 'next':
      return EN.told.next
    case 'leave':
      return EN.card.back
  }
}

export function primaryOf(s: PrimaryState): Primary {
  const kind = primaryKind(s)
  return {
    kind,
    label: label(kind),
    icon: ICON[kind],
    enabled: kind === 'story-place' || s.place.status === 'ready',
  }
}

export async function openPlace(slug: string): Promise<void> {
  const s = useStore.getState()
  if (placeSlug(s.place) !== slug || s.place.status !== 'ready') await s.open(slug)
  useStore.getState().enter()
}

export function runPrimary(kind: PrimaryKind): void {
  const s = useStore.getState()
  switch (kind) {
    case 'open':
    case 'story-place':
      void openPlace(STORY_PLACE.slug)
      return
    case 'play':
    case 'resume':
      s.setPlaying(true)
      return
    case 'pause':
      s.setPlaying(false)
      return
    case 'close':
      s.setTool('none')
      return
    case 'show':
    case 'next':
      s.openItem(nextChapter(s))
      return
    case 'leave':
      s.openItem(null)
      return
    case 'business': {
      const osm = heatObject(s)
      s.setMode('business')
      s.select(osm)
      return
    }
  }
}
