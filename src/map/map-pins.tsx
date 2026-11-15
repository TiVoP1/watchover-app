import type { Map as MapLibre } from 'maplibre-gl'
import { MapMarker } from '#web/map/map-marker.tsx'
import { focusOf, shownPins } from '#web/map/pins.ts'
import { selectChapter, selectItem, useStore } from '#web/state/store.ts'
import type { StoryItem } from '#web/story/chapters.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'
import { KIND_STYLE } from '#web/story/kinds.ts'
import { pinText } from '#web/story/story-text.ts'

const TAG_OFFSET: readonly [number, number] = [0, -6]

type Ring = 'stop' | 'open' | null

interface PinButtonProps {
  readonly item: StoryItem
  readonly ring: Ring
  readonly onOpen: () => void
}

function PinButton({ item, ring, onOpen }: PinButtonProps) {
  return (
    <button
      type="button"
      aria-label={pinText(item)}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className="relative -m-2 flex size-10 items-center justify-center rounded-full"
    >
      <KindDisc kind={item.kind} />
      {ring === null ? null : (
        <svg
          viewBox="0 0 32 32"
          className="pointer-events-none absolute inset-1 size-8"
          aria-hidden="true"
        >
          <circle
            cx="16"
            cy="16"
            r="15"
            fill="none"
            strokeWidth="2"
            className={ring === 'open' ? 'stroke-text' : KIND_STYLE[item.kind].stroke}
          />
        </svg>
      )}
    </button>
  )
}

export function MapPins({ map }: { readonly map: MapLibre }) {
  const place = useStore((s) => s.place)
  const frame = useStore((s) => s.frame)
  const inPlay = useStore((s) => s.playing || s.paused)
  const item = useStore(selectItem)
  const stop = useStore(selectChapter)
  const openItem = useStore((s) => s.openItem)
  if (place.status !== 'ready') return null
  const pins = shownPins(place.story, { inPlay, frame, item: item?.id ?? null })
  const focus = item === null ? null : focusOf(item, place.data)
  return (
    <>
      {pins.map((pin) => (
        <MapMarker key={pin.id} map={map} lonLat={pin.lonLat}>
          <PinButton
            item={pin.item}
            ring={inPlay && stop?.id === pin.id ? 'stop' : null}
            onOpen={() => {
              openItem(pin.id)
            }}
          />
        </MapMarker>
      ))}
      {item === null || focus?.tag == null ? null : (
        <MapMarker key={item.id} map={map} lonLat={focus.tag} anchor="bottom" offsetPx={TAG_OFFSET}>
          <PinButton
            item={item}
            ring="open"
            onOpen={() => {
              openItem(item.id)
            }}
          />
        </MapMarker>
      )}
    </>
  )
}
