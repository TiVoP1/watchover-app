import { type HeightsState, heightsState } from '#web/business/district.ts'
import { groundSentence } from '#web/business/ground.ts'
import type { Objects, PlaceData } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { toldSummary } from '#web/story/place-story.ts'
import { temperatureText } from '#web/story/story-text.ts'
import { formatDate, formatShortDate } from '#web/ui/format.ts'

export interface BusinessSentenceInput {
  readonly data: PlaceData
  readonly frame: number
  readonly playing: boolean
  readonly timeZone: string
}

export function restSentence(data: PlaceData): string {
  if (data.objects === null) {
    return groundSentence(data) ?? toldSummary(data)?.short ?? EN.business.empty
  }
  const labels = data.nullCheck?.objects ?? []
  if (labels.length === 0) return EN.business.unchecked
  const clear = labels.filter((o) => o.label === 'beats_all').length
  return EN.business.sentence(clear, labels.length)
}

function playSentence(objects: Objects, state: HeightsState, timeZone: string): string | null {
  if (state.kind === 'before') {
    return EN.business.beforeSeries(formatDate(state.pass.time, timeZone))
  }
  const celsius = objects.tracks[state.pass.key]?.temperature_c[state.pass.index] ?? null
  return celsius === null
    ? null
    : EN.business.play(formatShortDate(state.pass.time, timeZone), temperatureText(celsius))
}

export function businessSentence({
  data,
  frame,
  playing,
  timeZone,
}: BusinessSentenceInput): string | null {
  const objects = data.objects
  const time = data.radar?.frames[frame]?.time
  if (playing && objects !== null && time !== undefined) {
    const state = heightsState(objects, time)
    const sentence = state === null ? null : playSentence(objects, state, timeZone)
    if (sentence !== null) return sentence
  }
  return restSentence(data)
}
