import { EN } from '#web/i18n/en.ts'
import { Disclosure } from '#web/panel/disclosure.tsx'
import { selectZone, useStore } from '#web/state/store.ts'
import { FlipTile } from '#web/story/flip-tile.tsx'
import { KindDisc } from '#web/story/kind-disc.tsx'
import {
  nextTold,
  playable,
  type ToldItem,
  toldCardFacts,
  toldWhere,
} from '#web/story/place-story.ts'
import { measuredLines, sourceLines } from '#web/story/story-text.ts'
import { ToldChart } from '#web/story/told-chart.tsx'
import { Icon } from '#web/ui/icon.tsx'

export interface ToldCardProps {
  readonly item: ToldItem
}

const NAV = 'flex min-h-10 items-center gap-1 text-meta text-text-2 hover:text-text'
const TAG = 'rounded-sm border border-line px-1.5 text-text-2'

export function ToldCard({ item }: ToldCardProps) {
  const place = useStore((s) => s.place)
  const zone = useStore(selectZone)
  const openItem = useStore((s) => s.openItem)
  if (place.status !== 'ready') return null
  const { data, story } = place
  const { told } = item
  const next = nextTold(story, item.id)
  const only = next === null || next.id === item.id
  const primaryWalks = !playable(data)
  const measured = measuredLines(item)
  const sources = sourceLines(item)
  const back =
    primaryWalks && only ? null : (
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
    )
  const forward =
    next === null || only || primaryWalks ? null : (
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
    )
  return (
    <article className="pb-2">
      {back === null && forward === null ? (
        <div className="pt-3" />
      ) : (
        <nav className="flex items-center justify-between px-4">
          {back ?? <span />}
          {forward}
        </nav>
      )}
      <header className="grid grid-cols-[auto_1fr] gap-x-3 px-4 pt-1">
        <KindDisc kind={item.kind} />
        <h2 className="text-card font-semibold">{told.title}</h2>
        <p className="col-start-2 text-body text-text-2">{toldWhere(item.where)}</p>
        <p className="col-start-2 mt-1 flex flex-wrap items-center gap-x-2 tnum text-meta text-text-2">
          <span>{toldCardFacts(item, zone)}</span>
          {item.flags.early ? <span className={TAG}>{EN.card.early}</span> : null}
          {item.flags.estimate ? <span className={TAG}>{EN.card.estimate}</span> : null}
        </p>
      </header>
      <section className="mt-3 px-4">
        <h3 className="text-meta text-text-3">{EN.card.because}</h3>
        <p className="mt-1 tnum text-body text-text">{told.because}</p>
        <p className="mt-2 text-meta text-text-3">{told.notClaimed}</p>
      </section>
      <div className="mt-4 flex flex-col items-start gap-3 px-4">
        <FlipTile tile={item.tile} slug={data.slug} timeZone={zone} size="card" kind={item.kind}>
          <p className="tnum text-body text-text">{told.sentence}</p>
        </FlipTile>
        {told.chart === null ? null : (
          <ToldChart chart={told.chart} timeZone={zone} kind={item.kind} />
        )}
      </div>
      <div className="mt-4 border-t border-line">
        <Disclosure summary={EN.card.source(measured.length + sources.length)}>
          <ul className="flex flex-col gap-1.5">
            {measured.map((line) => (
              <li key={line} className="tnum text-meta text-text-2">
                {line}
              </li>
            ))}
            {sources.map((line) => (
              <li key={`${line.pass}|${line.scene}`}>
                <p className="tnum text-meta text-text-2">{EN.told.image(line.pass)}</p>
                <p className="text-meta break-all text-text-3">{line.scene}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-meta text-text-3">{EN.told.caveatsTitle}</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {told.caveats.map((caveat) => (
              <li
                key={caveat}
                className="rounded-sm border border-line px-1.5 text-meta text-text-2"
              >
                {caveat}
              </li>
            ))}
          </ul>
          {told.attribution === null ? null : (
            <p className="mt-3 text-meta text-text-3">{told.attribution}</p>
          )}
          <p className="mt-3 text-meta text-text-3">{EN.told.builtFrom(told.scenes.length)}</p>
          <ul className="mt-1 max-h-40 overflow-y-auto">
            {told.scenes.map((scene) => (
              <li key={scene} className="text-meta break-all text-text-3">
                {scene}
              </li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </article>
  )
}
