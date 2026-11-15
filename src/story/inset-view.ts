import { EN } from '#web/i18n/en.ts'
import type { Mode, Panel, Tool } from '#web/state/store.ts'
import { type Chapter, chapterByNumber, type Story } from '#web/story/chapters.ts'
import { confidenceWord, whereText } from '#web/story/story-text.ts'
import { formatMonth, formatShortDate } from '#web/ui/format.ts'

export interface InsetState {
  readonly mode: Mode
  readonly panel: Panel
  readonly playing: boolean
  readonly paused: boolean
  readonly tool: Tool
  readonly chapter: number | null
}

export type HeatChapter = Extract<Chapter, { readonly kind: 'heat' }>

export type InsetView =
  | { readonly kind: 'stop'; readonly chapter: Chapter; readonly total: number }
  | { readonly kind: 'teaser'; readonly chapter: HeatChapter }

const isHeat = (chapter: Chapter): chapter is HeatChapter => chapter.kind === 'heat'

export function insetView(state: InsetState, story: Story | null): InsetView | null {
  if (story === null || state.mode !== 'people' || state.tool !== 'none') return null
  if (state.panel === 'recap') {
    const chapter = story.chapters.find(isHeat)
    return chapter === undefined ? null : { kind: 'teaser', chapter }
  }
  const inPlay = state.playing || state.paused
  if (state.panel !== 'rest' || !inPlay || state.chapter === null) return null
  const chapter = chapterByNumber(story, state.chapter)
  return chapter === null ? null : { kind: 'stop', chapter, total: story.chapters.length }
}

const NO_BREAK = ' '

export function insetHeader(place: string, chapter: Chapter, timeZone: string): string {
  if (chapter.kind === 'heat') {
    const [first] = chapter.source.passes
    const last = chapter.source.passes.at(-1) ?? first
    const month = (iso: string) => formatMonth(new Date(iso), timeZone)
    return EN.inset.headerSpan(place, month(first.time), month(last.time))
  }
  return EN.inset.header(place, formatShortDate(chapter.time, timeZone).replaceAll(' ', NO_BREAK))
}

export const insetFacts = (chapter: Chapter): string =>
  EN.inset.facts(whereText(chapter.where), confidenceWord(chapter.confidence))
