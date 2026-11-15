import { businessSentence } from '#web/business/sentence.ts'
import { EN } from '#web/i18n/en.ts'
import { placeBySlug, STORY_PLACE } from '#web/places.ts'
import type { StoreState } from '#web/state/store.ts'
import { chapterAt, itemById, type Story, type StoryItem } from '#web/story/chapters.ts'
import type { ChangeKind } from '#web/story/kinds.ts'
import { toldSummary } from '#web/story/place-story.ts'
import { cloudPercent, itemSentence, missingDays, spanText } from '#web/story/story-text.ts'
import { formatDateTime } from '#web/ui/format.ts'

export type SentenceState = Pick<
  StoreState,
  | 'place'
  | 'panel'
  | 'frame'
  | 'playing'
  | 'paused'
  | 'chapter'
  | 'gap'
  | 'item'
  | 'mode'
  | 'tool'
  | 'notice'
  | 'nudge'
>

export interface Sentence {
  readonly when: string | null
  readonly kind: ChangeKind | null
  readonly text: string | null
}

function cloudShare(s: SentenceState, item: StoryItem | null): number | null {
  if (item?.clouds) return item.clouds.cloudShare
  if (s.place.status !== 'ready') return null
  const { radar, clouds } = s.place.data
  const day = radar?.frames[s.frame]?.time.slice(0, 10)
  return clouds?.days.find((d) => d.day === day)?.cloud_fraction ?? null
}

function toolText(s: SentenceState, item: StoryItem | null): string | null {
  if (s.place.status !== 'ready') return null
  if (s.tool === 'sharpen') {
    const looks = s.place.data.radar?.sharpen.steps.at(-1)?.looks
    return looks === undefined ? null : EN.sentence.sharpen(looks)
  }
  if (s.tool === 'clouds') {
    const share = cloudShare(s, item)
    return share === null ? null : EN.sentence.clouds(cloudPercent(share))
  }
  return null
}

function gapText(story: Story, s: SentenceState, timeZone: string): string | null {
  if (!s.gap || story.gap === null) return null
  const missing = missingDays(story.gap)
  const { from, to } = spanText(missing.from, missing.to, timeZone)
  return EN.sentence.gap(from, to)
}

function restText(story: Story, s: SentenceState): string {
  const slug = s.place.status === 'ready' ? s.place.data.slug : ''
  const place = placeBySlug(slug)
  const told = s.place.status === 'ready' ? toldSummary(s.place.data) : null
  if (told !== null) return told.short
  return story.changes.length > 0
    ? EN.sentence.rest(place.label, story.changes.length)
    : EN.rest.noStories
}

export function composeSentence(
  s: SentenceState,
  timeZone: string,
  drawnFrame: number | null,
): Sentence | null {
  if (s.place.status !== 'ready') return null
  const { data, story } = s.place
  const item = s.item === null ? null : itemById(story, s.item)
  const time = drawnFrame === null ? undefined : data.radar?.frames[drawnFrame]?.time
  const inPlay = s.playing || s.paused
  const business = s.mode === 'business' && (inPlay || data.objects === null)
  const dated = s.panel !== 'orbit' && s.tool !== 'sharpen' && !business
  const when = !dated || time === undefined ? null : formatDateTime(time, timeZone)
  const plain = (text: string | null): Sentence => ({ when, kind: null, text })
  const told = (shown: StoryItem): Sentence => ({
    when,
    kind: shown.kind,
    text: itemSentence(shown),
  })
  if (s.notice === 'fog') return plain(EN.sentence.fog)
  if (s.notice === 'quiet') return plain(EN.sentence.quietSpot(story.passes))
  if (s.notice === 'unanalysed') return plain(EN.sentence.unanalysed)
  const tool = s.tool === 'none' ? null : toolText(s, item)
  if (tool !== null) return plain(tool)
  if (s.panel === 'orbit' && s.nudge) return plain(EN.sentence.nudge(STORY_PLACE.label))
  if (s.mode === 'business') {
    return plain(businessSentence({ data, frame: s.frame, playing: inPlay, timeZone }))
  }
  if (s.panel === 'orbit') return plain(EN.sentence.orbit)
  if (inPlay) {
    if (s.gap) return plain(gapText(story, s, timeZone))
    const shown = drawnFrame === null ? null : chapterAt(story, drawnFrame)
    return shown === null ? plain(EN.sentence.quiet) : told(shown)
  }
  if (s.panel === 'story' && item !== null) return told(item)
  return plain(restText(story, s))
}
