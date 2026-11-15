import { create } from 'zustand'
import { dataUrl } from '#web/data/load.ts'
import type { Corners, PlaceData, RadarFrame } from '#web/data/types.ts'
import {
  backgroundFrame,
  chapterAt,
  displayFrame,
  type Story,
  type StoryItem,
} from '#web/story/chapters.ts'

export interface RadarImage {
  readonly url: string
  readonly frame: number
  readonly falseColour: boolean
  readonly pixelM: number
}

export interface MaskImage {
  readonly url: string
  readonly corners: Corners
}

export interface DrawInput {
  readonly data: PlaceData
  readonly story: Story
  readonly frame: number
  readonly item: StoryItem | null
  readonly business: boolean
}

export function businessFrame(story: Story, frames: readonly RadarFrame[], head: number): number {
  const shown = backgroundFrame(frames, story.background, head)
  const { gap, background } = story
  if (gap === null || background === null || shown > gap.lastBefore || head < gap.firstAfter) {
    return shown
  }
  const next = frames.findIndex(
    (f, i) => i >= head && f.track === background.track && f.direction === background.direction,
  )
  return next === -1 ? shown : next
}

export function radarFrame(input: DrawInput): number | null {
  const radar = input.data.radar
  if (radar === null) return null
  const { story, frame, item } = input
  return input.business
    ? businessFrame(story, radar.frames, frame)
    : displayFrame(story, radar.frames, frame, item)
}

export function radarImage(
  data: PlaceData,
  frame: number | null,
  falseColour: boolean,
): RadarImage | null {
  const radar = data.radar
  const image = frame === null ? undefined : radar?.frames[frame]
  if (radar === null || image === undefined || frame === null) return null
  const path = falseColour ? image.false_colour : image.frame
  return { url: dataUrl(data.slug, path), frame, falseColour, pixelM: radar.pixel_m }
}

export function frostMask(input: DrawInput): MaskImage | null {
  const events = input.data.events
  if (events === null || input.business) return null
  const focus = input.item ?? chapterAt(input.story, input.frame)
  if (focus?.kind !== 'frost' || focus.tile.variant !== 'radar' || focus.tile.mask === null) {
    return null
  }
  return { url: dataUrl(input.data.slug, focus.tile.mask), corners: events.corners_lonlat }
}

const OPAQUE_ALPHA_MIN = 128
const RGBA = 4
export const PARTIAL_MIN_SHARE = 0.02

export function transparentShare(rgba: ArrayLike<number>): number {
  const pixels = Math.floor(rgba.length / RGBA)
  if (pixels === 0) return 0
  let clear = 0
  for (let i = 0; i < pixels; i++) if ((rgba[i * RGBA + RGBA - 1] ?? 0) < OPAQUE_ALPHA_MIN) clear++
  return clear / pixels
}

export interface DrawnState {
  readonly radar: RadarImage | null
  readonly mask: boolean
  readonly partial: boolean
  readonly setRadar: (radar: RadarImage | null) => void
  readonly setMask: (mask: boolean) => void
  readonly setPartial: (url: string, partial: boolean) => void
}

export const useDrawn = create<DrawnState>()((set, get) => ({
  radar: null,
  mask: false,
  partial: false,
  setRadar: (radar) => {
    set({ radar, partial: false })
  },
  setMask: (mask) => {
    set({ mask })
  },
  setPartial: (url, partial) => {
    if (get().radar?.url === url) set({ partial })
  },
}))
