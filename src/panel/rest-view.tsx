import { businessKind } from '#web/business/event.ts'
import { NISAR_REPEAT_DAYS } from '#web/data/nisar.ts'
import type { PlaceData } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { ChangeRow } from '#web/panel/change-row.tsx'
import { Disclosure } from '#web/panel/disclosure.tsx'
import { MoreSection } from '#web/panel/sections.tsx'
import { placeBySlug } from '#web/places.ts'
import { selectStory, selectZone, useStore } from '#web/state/store.ts'
import type { Story } from '#web/story/chapters.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'
import { isTold, type ToldItem, toldFacts, toldSummary } from '#web/story/place-story.ts'
import { Icon } from '#web/ui/icon.tsx'

function BusinessEntry({ data }: { readonly data: PlaceData }) {
  const story = useStore(selectStory)
  const setMode = useStore((s) => s.setMode)
  const inPlay = useStore((s) => s.playing || s.paused)
  const kind = businessKind(data, story)
  if (kind === null || inPlay) return null
  return (
    <button
      type="button"
      onClick={() => {
        setMode('business')
      }}
      className="mt-3 flex items-center gap-2 rounded-sm border border-control px-3 py-1.5 text-left text-body hover:bg-raised"
    >
      <Icon name="briefcase" size={20} className="shrink-0" />
      {EN.rest.business[kind]}
    </button>
  )
}

interface ToldRowProps {
  readonly item: ToldItem
  readonly current: boolean
}

function ToldRow({ item, current }: ToldRowProps) {
  const openItem = useStore((s) => s.openItem)
  const zone = useStore(selectZone)
  return (
    <li className={`border-b border-line last:border-b-0 ${current ? 'bg-raised' : ''}`}>
      <button
        type="button"
        aria-current={current ? 'step' : undefined}
        onClick={() => {
          openItem(item.id)
        }}
        className="grid w-full grid-cols-[auto_1fr] gap-x-3 px-4 py-2.5 text-left hover:bg-raised"
      >
        <KindDisc kind={item.kind} />
        <span className="self-center text-body font-medium text-text">{item.told.title}</span>
        <span className="col-start-2 tnum text-meta text-text-2">{toldFacts(item, zone)}</span>
      </button>
    </li>
  )
}

interface ToldRestProps {
  readonly data: PlaceData
  readonly story: Story
  readonly current: number | null
}

function ToldRest({ data, story, current }: ToldRestProps) {
  const summary = toldSummary(data)
  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-card font-semibold">{placeBySlug(data.slug).name}</h2>
        {summary === null ? null : (
          <p className="mt-2 tnum text-body font-medium text-text">{summary.long}</p>
        )}
        <p className="mt-2 text-body text-text-2">{EN.rest.goal(NISAR_REPEAT_DAYS)}</p>
        <BusinessEntry data={data} />
      </div>
      <ul className="border-y border-line">
        {story.chapters.filter(isTold).map((item) => (
          <ToldRow key={item.id} item={item} current={item.n === current} />
        ))}
      </ul>
      <MoreSection />
    </>
  )
}

export function RestView() {
  const place = useStore((s) => s.place)
  const inPlay = useStore((s) => s.playing || s.paused)
  const current = useStore((s) => (s.playing || s.paused ? s.chapter : null))
  if (place.status !== 'ready') return null
  const { data, story } = place
  if (story.chapters.some(isTold)) return <ToldRest data={data} story={story} current={current} />
  const entry = placeBySlug(data.slug)
  const stories = story.changes.length > 0
  const latestPass = data.radar?.frames.at(-1)?.time ?? ''
  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-card font-semibold">{entry.label}</h2>
        <p className="mt-1 text-body text-text-2">
          {EN.rest.goal(NISAR_REPEAT_DAYS)}
          {stories && inPlay ? null : <> {stories ? EN.rest.pressPlay : EN.rest.noStories}</>}
        </p>
        <BusinessEntry data={data} />
      </div>
      {stories ? (
        <>
          <ul className="border-t border-line">
            {story.changes.map((item) => (
              <ChangeRow
                key={item.id}
                item={item}
                current={item.n === current}
                latestPass={latestPass}
              />
            ))}
          </ul>
          <p className="border-b border-line px-4 pt-1 pb-3 text-meta text-text-3">
            {EN.rest.clearest(story.changes.length)}
          </p>
          {story.secondary.length > 0 ? (
            <Disclosure summary={EN.rest.moreChanges(story.secondary.length)} flush>
              <ul>
                {story.secondary.map((item) => (
                  <ChangeRow key={item.id} item={item} current={false} latestPass={latestPass} />
                ))}
              </ul>
            </Disclosure>
          ) : null}
        </>
      ) : (
        <div className="border-b border-line" />
      )}
      <MoreSection />
    </>
  )
}
