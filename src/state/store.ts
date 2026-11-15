import { create } from 'zustand'
import { loadPlace } from '#web/data/load.ts'
import type { PlaceData } from '#web/data/types.ts'
import { placeBySlug } from '#web/places.ts'
import {
  buildStory,
  type Chapter,
  chapterAt,
  chapterByNumber,
  itemById,
  playStartFrame,
  type Story,
  type StoryItem,
} from '#web/story/chapters.ts'
import { withTold } from '#web/story/place-story.ts'

export type Panel = 'orbit' | 'rest' | 'story' | 'recap'
export type Tool = 'none' | 'clouds' | 'sharpen'
export type Mode = 'people' | 'business'
export type Notice = 'fog' | 'quiet' | 'unanalysed'

export interface PlayStep {
  readonly frame: number
  readonly chapter: number | null
  readonly gap: boolean
}

export type LoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly slug: string }
  | { readonly status: 'ready'; readonly data: PlaceData; readonly story: Story }
  | { readonly status: 'error'; readonly slug: string; readonly message: string }

export interface StoreState {
  readonly place: LoadState
  readonly panel: Panel
  /** Index into radar.frames under the timeline head; the map draws displayFrame() of it. */
  readonly frame: number
  readonly playing: boolean
  readonly paused: boolean
  readonly chapter: number | null
  readonly gap: boolean
  readonly resumeAt: PlayStep | null
  readonly item: string | null
  readonly mode: Mode
  readonly tool: Tool
  readonly selectedObject: string | null
  readonly falseColour: boolean
  readonly autoDive: boolean
  readonly notice: Notice | null
  readonly nudge: boolean
  open: (slug: string) => Promise<void>
  enter: () => void
  back: () => void
  setFrame: (frame: number) => void
  setPlaying: (playing: boolean) => void
  playAt: (step: PlayStep) => void
  finishPlay: () => void
  showRecap: () => void
  freezeChapter: (n: number) => void
  openItem: (id: string | null) => void
  setMode: (mode: Mode) => void
  setTool: (tool: Tool) => void
  select: (osm: string | null) => void
  setFalseColour: (on: boolean) => void
  setAutoDive: (on: boolean) => void
  setNotice: (notice: Notice | null) => void
  setNudge: (nudge: boolean) => void
}

const frameCount = (place: LoadState): number =>
  place.status === 'ready' ? (place.data.radar?.frames.length ?? 0) : 0

const clampFrame = (place: LoadState, frame: number): number =>
  Math.max(0, Math.min(frameCount(place) - 1, Math.round(frame)))

const NO_PLAY = { playing: false, paused: false, chapter: null, gap: false } as const

const pausedAt = (step: PlayStep) =>
  ({
    panel: 'rest',
    item: null,
    tool: 'none',
    playing: false,
    paused: true,
    frame: step.frame,
    chapter: step.chapter,
    gap: step.gap,
    resumeAt: null,
  }) as const

function resumePoint(s: StoreState): PlayStep | null {
  if (s.mode === 'people' && (s.playing || s.paused)) {
    return { frame: s.frame, chapter: s.chapter, gap: s.gap }
  }
  return s.panel === 'story' ? s.resumeAt : null
}

export const useStore = create<StoreState>()((set, get) => ({
  place: { status: 'idle' },
  panel: 'orbit',
  frame: 0,
  ...NO_PLAY,
  resumeAt: null,
  item: null,
  mode: 'people',
  tool: 'none',
  selectedObject: null,
  falseColour: false,
  autoDive: false,
  notice: null,
  nudge: false,
  open: async (slug) => {
    set({
      place: { status: 'loading', slug },
      panel: 'orbit',
      ...NO_PLAY,
      resumeAt: null,
      item: null,
      tool: 'none',
      selectedObject: null,
      notice: null,
    })
    try {
      const data = await loadPlace(slug)
      const current = get().place
      if (current.status !== 'loading' || current.slug !== slug) return
      const story = withTold(buildStory(data), data)
      set({ place: { status: 'ready', data, story }, frame: story.restFrame })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ place: { status: 'error', slug, message } })
    }
  },
  enter: () => {
    const { place, panel } = get()
    if (place.status !== 'ready' || panel !== 'orbit') return
    set({ panel: 'rest', notice: null })
  },
  back: () => {
    const s = get()
    if (s.tool !== 'none') {
      set({ tool: 'none', notice: null })
    } else if (s.playing) {
      set({ playing: false, paused: true, notice: null })
    } else if (s.paused || s.notice !== null) {
      set({ ...NO_PLAY, notice: null })
    } else if (s.panel === 'story') {
      set(s.resumeAt === null ? { panel: 'rest', item: null } : pausedAt(s.resumeAt))
    } else if (s.panel === 'recap') {
      set({ panel: 'rest' })
    } else if (s.mode === 'business' && s.selectedObject !== null) {
      set({ selectedObject: null })
    } else if (s.panel === 'rest') {
      set({ panel: 'orbit' })
    }
  },
  setFrame: (frame) => {
    const { place, panel } = get()
    set({
      frame: clampFrame(place, frame),
      ...NO_PLAY,
      resumeAt: null,
      notice: null,
      ...(panel === 'recap' || panel === 'story' ? { panel: 'rest', item: null } : {}),
    })
  },
  setPlaying: (playing) => {
    const s = get()
    if (s.place.status !== 'ready' || s.panel === 'orbit') return
    if (!playing) {
      if (s.playing) set({ playing: false, paused: true })
      return
    }
    if (s.playing) return
    if (s.resumeAt !== null) {
      const stop = s.resumeAt
      set({
        ...pausedAt(stop),
        playing: true,
        paused: false,
        frame: clampFrame(s.place, stop.frame),
        notice: null,
      })
      return
    }
    if (s.paused && s.frame < frameCount(s.place) - 1) {
      set({ playing: true, paused: false, notice: null })
      return
    }
    const start = playStartFrame(s.place.data, s.mode)
    set({
      playing: true,
      paused: false,
      gap: false,
      resumeAt: null,
      frame: start,
      chapter: s.mode === 'people' ? (chapterAt(s.place.story, start)?.n ?? null) : null,
      item: null,
      tool: 'none',
      notice: null,
      ...(s.mode === 'people' ? { panel: 'rest' } : {}),
    })
  },
  playAt: ({ frame, chapter, gap }) => {
    const { place, playing } = get()
    if (!playing) return
    set({ frame: clampFrame(place, frame), chapter, gap })
  },
  finishPlay: () => {
    const { mode } = get()
    set({ ...NO_PLAY, resumeAt: null, ...(mode === 'people' ? { panel: 'recap' } : {}) })
  },
  showRecap: () => {
    const { place } = get()
    if (place.status !== 'ready' || place.story.chapters.length === 0) return
    const last = (place.data.radar?.frames.length ?? 1) - 1
    set({
      ...NO_PLAY,
      resumeAt: null,
      panel: 'recap',
      mode: 'people',
      frame: last,
      item: null,
      tool: 'none',
      notice: null,
    })
  },
  freezeChapter: (n) => {
    const { place } = get()
    if (place.status !== 'ready') return
    const chapter = chapterByNumber(place.story, n)
    if (chapter === null) return
    set({
      panel: 'rest',
      mode: 'people',
      frame: chapter.frame,
      playing: false,
      paused: true,
      chapter: n,
      gap: false,
      resumeAt: null,
      item: null,
      tool: 'none',
      notice: null,
    })
  },
  openItem: (id) => {
    const s = get()
    if (id === null) {
      if (s.panel !== 'story') return
      set(s.resumeAt === null ? { panel: 'rest', item: null, tool: 'none' } : pausedAt(s.resumeAt))
      return
    }
    if (s.place.status !== 'ready') return
    const item = itemById(s.place.story, id)
    if (item === null) return
    set({
      panel: 'story',
      ...NO_PLAY,
      resumeAt: resumePoint(s),
      mode: 'people',
      item: id,
      frame: item.frame,
      tool: 'none',
      notice: null,
    })
  },
  setMode: (mode) => {
    const { place, panel } = get()
    if (mode === get().mode) return
    const stay = panel === 'orbit' && place.status !== 'ready'
    set({
      mode,
      ...(stay ? {} : { panel: 'rest' }),
      ...NO_PLAY,
      resumeAt: null,
      item: null,
      tool: 'none',
      notice: null,
    })
  },
  setTool: (tool) => {
    const { place, panel } = get()
    const landed = tool !== 'none' && panel === 'orbit' && place.status === 'ready'
    set({ tool, ...NO_PLAY, notice: null, ...(landed ? { panel: 'rest' } : {}) })
  },
  select: (osm) => {
    set({ selectedObject: osm })
  },
  setFalseColour: (falseColour) => {
    set({ falseColour })
  },
  setAutoDive: (autoDive) => {
    set({ autoDive })
  },
  setNotice: (notice) => {
    if (!get().playing) set({ notice })
  },
  setNudge: (nudge) => {
    if (get().nudge !== nudge) set({ nudge })
  },
}))

export const placeSlug = (place: LoadState): string | null =>
  place.status === 'ready' ? place.data.slug : place.status === 'idle' ? null : place.slug

export const selectZone = (s: StoreState): string => placeBySlug(placeSlug(s.place) ?? '').timeZone

export const selectStory = (s: StoreState): Story | null =>
  s.place.status === 'ready' ? s.place.story : null

export const selectItem = (s: StoreState): StoryItem | null =>
  s.place.status === 'ready' && s.item !== null ? itemById(s.place.story, s.item) : null

export const selectChapter = (s: StoreState): Chapter | null =>
  s.place.status === 'ready' && s.chapter !== null
    ? chapterByNumber(s.place.story, s.chapter)
    : null
