import { selectErrorScale } from '#web/business/motion.ts'
import { EN } from '#web/i18n/en.ts'
import { Disclosure } from '#web/panel/disclosure.tsx'
import { selectZone, useStore } from '#web/state/store.ts'
import type { Story, StoryItem } from '#web/story/chapters.ts'
import { FlipTile } from '#web/story/flip-tile.tsx'
import { KindDisc } from '#web/story/kind-disc.tsx'
import {
  becauseText,
  cardFactsText,
  cardTitle,
  lookSentence,
  metaText,
  notClaimedText,
  sourceLines,
  sourceTermText,
  whereText,
} from '#web/story/story-text.ts'
import { Icon } from '#web/ui/icon.tsx'

export interface StoryCardProps {
  readonly item: StoryItem
}

const NAV = 'flex min-h-10 items-center gap-1 text-meta text-text-2 hover:text-text'

function nextChange(story: Story, item: StoryItem): StoryItem | null {
  const order = [...story.changes, ...story.secondary]
  const next = order[(order.findIndex((c) => c.id === item.id) + 1) % order.length]
  return next === undefined || next.id === item.id ? null : next
}

export function StoryCard({ item }: StoryCardProps) {
  const place = useStore((s) => s.place)
  const zone = useStore(selectZone)
  const openItem = useStore((s) => s.openItem)
  const setTool = useStore((s) => s.setTool)
  const errorScale = useStore(selectErrorScale)
  if (place.status !== 'ready') return null
  const { data, story } = place
  const latestPass = data.radar?.frames.at(-1)?.time ?? ''
  const next = nextChange(story, item)
  const meta = metaText(item, errorScale)
  const term = sourceTermText(item, errorScale)
  const sources = sourceLines(item)
  return (
    <article className="pb-2">
      <nav className="flex items-center justify-between px-4">
        <button
          type="button"
          onClick={() => {
            openItem(null)
          }}
          className={NAV}
        >
          <Icon name="caret-left" size={16} />
          {EN.card.back}
        </button>
        {next === null ? null : (
          <button
            type="button"
            onClick={() => {
              openItem(next.id)
            }}
            className={NAV}
          >
            {EN.card.next}
            <Icon name="caret-right" size={16} />
          </button>
        )}
      </nav>
      <header className="grid grid-cols-[auto_1fr] gap-x-3 px-4 pt-1">
        <KindDisc kind={item.kind} />
        <h2 className="text-card font-semibold">{cardTitle(item, zone)}</h2>
        <p className="col-start-2 text-body text-text-2">{whereText(item.where)}</p>
        <p className="col-start-2 mt-1 flex flex-wrap items-center gap-x-2 tnum text-meta text-text-2">
          <span>{cardFactsText(item, zone, latestPass)}</span>
          {item.flags.early ? (
            <span className="rounded-sm border border-line px-1.5 text-text-2">
              {EN.card.early}
            </span>
          ) : null}
        </p>
      </header>
      <section className="mt-3 px-4">
        <h3 className="text-meta text-text-3">{EN.card.because}</h3>
        <p className="mt-1 text-body text-text">{becauseText(item, zone)}</p>
        {meta === null ? null : <p className="mt-2 text-meta text-text-3">{meta}</p>}
        <p className="mt-2 text-meta text-text-3">{notClaimedText(item)}</p>
      </section>
      <div className="mt-4 flex flex-col items-start gap-2 px-4">
        <FlipTile tile={item.tile} slug={data.slug} timeZone={zone} size="card" kind={item.kind}>
          <p className="text-body text-text">{lookSentence(item, zone, latestPass)}</p>
        </FlipTile>
        {item.clouds === null ? null : (
          <button
            type="button"
            onClick={() => {
              setTool('clouds')
            }}
            className="flex items-center gap-2 rounded-sm border border-control px-3 py-1.5 text-body hover:bg-raised"
          >
            <Icon name="cloud-slash" size={20} />
            {EN.card.throughClouds}
          </button>
        )}
      </div>
      <div className="mt-4 border-t border-line">
        <Disclosure summary={EN.card.source(sources.length)}>
          {term === null ? null : <p className="mb-2 tnum text-meta text-text-2">{term}</p>}
          <ul className="flex flex-col gap-1.5">
            {sources.map((line) => (
              <li key={`${line.pass}|${line.scene}`}>
                <p className="tnum text-meta text-text-2">{line.pass}</p>
                <p className="text-meta break-all text-text-3">{line.scene}</p>
              </li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </article>
  )
}
