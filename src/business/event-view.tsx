import { activeEvent, eventWhy } from '#web/business/event.ts'
import { EN } from '#web/i18n/en.ts'
import { Disclosure } from '#web/panel/disclosure.tsx'
import { selectZone, useStore } from '#web/state/store.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'
import { type ToldItem, toldFacts } from '#web/story/place-story.ts'
import { measuredLines, sourceLines } from '#web/story/story-text.ts'
import { tileLegend } from '#web/story/tile.ts'

const TAG = 'rounded-sm border border-line px-1.5 text-text-2'

function EventDetail({ item }: { readonly item: ToldItem }) {
  const { told } = item
  const measured = measuredLines(item)
  const sources = sourceLines(item)
  const legend = tileLegend(item.tile)
  return (
    <>
      <div className="px-4 pt-1 pb-3">
        <p className="tnum text-body text-text">{told.sentence}</p>
        {legend === null ? null : <p className="mt-1 text-meta text-text-3">{legend}</p>}
        <p className="mt-3 text-meta text-text-3">{EN.card.because}</p>
        <p className="tnum text-body text-text">{told.businessBecause}</p>
        <p className="mt-2 text-meta text-text-3">{told.notClaimed}</p>
      </div>
      <div className="border-t border-line">
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
              <li key={caveat} className={`text-meta ${TAG}`}>
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
    </>
  )
}

export function EventView({ items }: { readonly items: readonly ToldItem[] }) {
  const selected = useStore((s) => s.selectedObject)
  const select = useStore((s) => s.select)
  const zone = useStore(selectZone)
  const active = activeEvent(items, selected)
  const single = items.length === 1
  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-card font-semibold">{EN.business.event.question}</h2>
        {active === null ? null : <p className="mt-2 text-body text-text-2">{eventWhy(active)}</p>}
        <p className="mt-1 text-meta text-text-3">{EN.business.event.delay}</p>
      </div>
      <ul className="border-t border-line">
        {items.map((item) => {
          const current = item.id === active?.id
          const open = item.id === selected || (single && current)
          return (
            <li key={item.id} className="border-b border-line">
              <button
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => {
                  select(item.id)
                }}
                className={`grid w-full grid-cols-[auto_1fr] gap-x-3 px-4 py-2.5 text-left hover:bg-raised ${current ? 'bg-raised' : ''}`}
              >
                <KindDisc kind={item.kind} />
                <span className="self-center text-body font-medium text-text">
                  {item.told.title}
                </span>
                <span className="col-start-2 flex flex-wrap items-center gap-x-2 tnum text-meta text-text-2">
                  <span>{toldFacts(item, zone)}</span>
                  {item.flags.early ? <span className={TAG}>{EN.card.early}</span> : null}
                </span>
              </button>
              {open ? <EventDetail item={item} /> : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
