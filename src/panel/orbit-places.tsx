import { NISAR_REPEAT_DAYS } from '#web/data/nisar.ts'
import { EN } from '#web/i18n/en.ts'
import { usePlaceCounts } from '#web/map/place-counts.ts'
import { openPlace } from '#web/panel/primary.ts'
import { type PlaceEntry, PLACES, placeName, STORY_PLACE } from '#web/places.ts'
import { type LoadState, useStore } from '#web/state/store.ts'

function placeLine(
  p: PlaceEntry,
  place: LoadState,
  counts: ReadonlyMap<string, number>,
): string | null {
  if (place.status === 'ready' && place.data.slug === p.slug) {
    return EN.globe.changes(place.story.changes.length)
  }
  const count = counts.get(p.slug)
  if (count !== undefined) return EN.globe.changes(count)
  return p.slug === STORY_PLACE.slug ? EN.globe.stories : null
}

export function OrbitPlaces() {
  const place = useStore((s) => s.place)
  const counts = usePlaceCounts()
  return (
    <>
      <p className="px-4 pt-4 pb-3 text-body text-text-2">{EN.globe.goal(NISAR_REPEAT_DAYS)}</p>
      <ul aria-label={EN.globe.places} className="border-t border-line">
        {PLACES.map((p) => {
          const suggested = p.slug === STORY_PLACE.slug
          return (
            <li key={p.slug} className="border-b border-line">
              <button
                type="button"
                onClick={() => {
                  void openPlace(p.slug)
                }}
                className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-raised"
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="text-body font-medium text-text">{placeName(p)}</span>
                  {suggested ? (
                    <span className="shrink-0 text-meta text-text-2">{EN.map.startHere}</span>
                  ) : null}
                </span>
                <span className="min-h-4.5 tnum text-meta text-text-2">
                  {placeLine(p, place, counts)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
