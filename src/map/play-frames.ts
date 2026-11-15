import { dataUrl } from '#web/data/load.ts'
import type { PlaceData, RadarFrame } from '#web/data/types.ts'
import { businessFrame, type RadarImage } from '#web/map/drawn.ts'
import type { Mode } from '#web/state/store.ts'
import { chapterAt, playStartFrame, type Story } from '#web/story/chapters.ts'
import { loadImage } from '#web/story/images.ts'

export const PRELOAD_AT_ONCE = 4

const onTrack = (story: Story, pass: RadarFrame | undefined): boolean =>
  story.background !== null &&
  pass?.track === story.background.track &&
  pass.direction === story.background.direction

export function playFrame(story: Story, frames: readonly RadarFrame[], head: number): number {
  for (let i = Math.min(head, frames.length - 1); i >= 0; i--) {
    if (onTrack(story, frames[i]) || chapterAt(story, i) !== null) return i
  }
  return head
}

export function playImage(data: PlaceData, frame: number): RadarImage | null {
  const play = data.play
  const pass = data.radar?.frames[frame]
  if (play === null || pass === undefined) return null
  const light = play.frames.find((f) => f.full_frame === pass.frame)
  if (light === undefined) return null
  return {
    url: dataUrl(data.slug, light.frame),
    frame,
    falseColour: false,
    pixelM: Math.round((play.pixel_m * play.full_out_px) / play.out_px),
  }
}

export function playOrder(data: PlaceData, story: Story, mode: Mode): readonly string[] {
  const frames = data.radar?.frames ?? []
  const urls = new Set<string>()
  for (let head = playStartFrame(data, mode); head < frames.length; head++) {
    const drawn =
      mode === 'people' ? playFrame(story, frames, head) : businessFrame(story, frames, head)
    const url = playImage(data, drawn)?.url
    if (url !== undefined) urls.add(url)
  }
  return [...urls]
}

export function preloadImages(urls: readonly string[], atOnce = PRELOAD_AT_ONCE): () => void {
  let next = 0
  let stopped = false
  const pump = () => {
    const url = urls[next]
    if (stopped || url === undefined) return
    next += 1
    loadImage(url).then(pump, pump)
  }
  for (let i = 0; i < atOnce; i++) pump()
  return () => {
    stopped = true
  }
}
