import {
  type GroundOverlay,
  groundExample,
  groundOverlay,
  overlayOn,
} from '#web/business/ground.ts'
import type { PlaceData, StoryOverlay } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import type { Story } from '#web/story/chapters.ts'
import type { ChangeKind } from '#web/story/kinds.ts'
import { isTold, type ToldItem } from '#web/story/place-story.ts'
import { directionWord } from '#web/story/story-text.ts'
import { formatUtcDate } from '#web/ui/format.ts'

export type BusinessKind = 'buildings' | 'ground' | 'event'

const WHY: Readonly<Partial<Record<ChangeKind, string>>> = EN.business.event.why

export const eventItems = (story: Story | null): readonly ToldItem[] =>
  story === null ? [] : story.chapters.filter(isTold)

export function businessKind(data: PlaceData, story: Story | null): BusinessKind | null {
  if (data.objects !== null) return 'buildings'
  if (groundExample(data) !== null) return 'ground'
  return eventItems(story).length > 0 ? 'event' : null
}

export const activeEvent = (items: readonly ToldItem[], selected: string | null): ToldItem | null =>
  items.find((item) => item.id === selected) ?? items[0] ?? null

export const eventWhy = (item: ToldItem): string => WHY[item.kind] ?? EN.business.event.why.other

const overlayOf = (data: PlaceData, item: ToldItem): StoryOverlay | null =>
  data.story?.chapters.find((c) => c.id === item.id)?.overlay ?? null

export function businessOverlay(
  data: PlaceData,
  story: Story | null,
  selected: string | null,
): GroundOverlay | null {
  if (businessKind(data, story) !== 'event') return groundOverlay(data)
  const item = activeEvent(eventItems(story), selected)
  const overlay = item === null ? null : overlayOf(data, item)
  return overlay === null ? null : overlayOn(data, overlay)
}

export function eventPlate(
  data: PlaceData,
  story: Story | null,
  selected: string | null,
  shownFrame: number,
): string | null {
  if (businessKind(data, story) !== 'event') return null
  const item = activeEvent(eventItems(story), selected)
  const image = item === null ? null : (overlayOf(data, item)?.image ?? null)
  const pair = data.eventPairs?.find((p) => image !== null && p.image === image)
  if (pair === undefined) return null
  const shown = data.radar?.frames[shownFrame]
  const sameTrack = shown?.track === pair.track && shown.direction === pair.direction
  const pixel = pair.pixelM === data.radar?.pixel_m ? null : pair.pixelM
  return [
    EN.map.plate.change(pair.product, formatUtcDate(pair.from), formatUtcDate(pair.to)),
    ...(sameTrack ? [] : [EN.map.plate.track(pair.track, directionWord(pair.direction))]),
    ...(pixel === null ? [] : [EN.map.plate.pixel(pixel)]),
  ].join(', ')
}
