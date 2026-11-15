import { useEffect } from 'react'
import { dataUrl } from '#web/data/load.ts'
import { EN } from '#web/i18n/en.ts'
import { selectStory, selectZone, useStore } from '#web/state/store.ts'
import { FlipTile } from '#web/story/flip-tile.tsx'
import { loadImage } from '#web/story/images.ts'
import { insetFacts, insetHeader, insetView } from '#web/story/inset-view.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'
import { buildingHeadline, confidenceWord, itemSentence } from '#web/story/story-text.ts'
import { tilePaths } from '#web/story/tile.ts'

const SHELL =
  'absolute top-3 right-3 flex w-85 max-w-3/10 flex-col gap-2 rounded-md border border-line bg-panel p-3 text-left short:gap-1 short:p-2'

function usePreload() {
  const story = useStore(selectStory)
  const slug = useStore((s) => (s.place.status === 'ready' ? s.place.data.slug : null))
  const landed = useStore((s) => s.panel !== 'orbit')
  useEffect(() => {
    if (story === null || slug === null || !landed) return
    for (const chapter of story.chapters) {
      for (const path of tilePaths(chapter.insetTile)) {
        void loadImage(dataUrl(slug, path)).catch(() => null)
      }
    }
  }, [story, slug, landed])
}

export function ChangeInset() {
  usePreload()
  const place = useStore((s) => s.place)
  const mode = useStore((s) => s.mode)
  const panel = useStore((s) => s.panel)
  const playing = useStore((s) => s.playing)
  const paused = useStore((s) => s.paused)
  const tool = useStore((s) => s.tool)
  const chapter = useStore((s) => s.chapter)
  const timeZone = useStore(selectZone)
  const openItem = useStore((s) => s.openItem)
  if (place.status !== 'ready') return null
  const view = insetView({ mode, panel, playing, paused, tool, chapter }, place.story)
  if (view === null) return null
  const { slug } = place.data
  if (view.kind === 'teaser') {
    const { chapter: building } = view
    const headline = buildingHeadline(building.heat.object.kind, building.range)
    return (
      <div data-inset="teaser" className={SHELL}>
        <span className="flex items-center gap-2">
          <KindDisc kind="heat" />
          <span className="min-w-0 flex-1 text-body font-medium text-text">{EN.inset.teaser}</span>
        </span>
        <FlipTile
          tile={building.insetTile}
          slug={slug}
          timeZone={timeZone}
          size="inset"
          kind="heat"
        >
          <span className="text-body text-text">{headline}</span>
        </FlipTile>
      </div>
    )
  }
  const { chapter: stop, total } = view
  const header = insetHeader(place.data.catalog.place.name, stop, timeZone)
  const sentence = itemSentence(stop)
  const facts = insetFacts(stop)
  return (
    <button
      type="button"
      data-inset="stop"
      aria-label={EN.inset.open(header, sentence, facts)}
      onClick={() => {
        openItem(stop.id)
      }}
      className={`${SHELL} hover:border-control`}
    >
      <span className="flex items-center gap-2">
        <KindDisc kind={stop.kind} />
        <span className="min-w-0 flex-1 text-body font-medium text-text">{header}</span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="tnum text-meta text-text-3">{EN.inset.counter(stop.n, total)}</span>
          <span className="text-meta text-text-2">{confidenceWord(stop.confidence)}</span>
        </span>
      </span>
      <FlipTile
        key={stop.id}
        tile={stop.insetTile}
        slug={slug}
        timeZone={timeZone}
        size="inset"
        kind={stop.kind}
        early={stop.flags.early}
      >
        <span className="text-body text-text">{sentence}</span>
      </FlipTile>
    </button>
  )
}
