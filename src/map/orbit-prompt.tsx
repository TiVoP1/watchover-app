import type { Polygon } from 'geojson'
import type { Map as MapLibre } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { EN } from '#web/i18n/en.ts'
import { MapMarker } from '#web/map/map-marker.tsx'
import { nextSwath } from '#web/map/orbit.ts'
import { usePlaceCounts } from '#web/map/place-counts.ts'
import { type LabelSide, type PlaceEntry, PLACES, placeName, STORY_PLACE } from '#web/places.ts'
import { useMinuteClock } from '#web/state/clock.ts'
import { placeSlug, useStore } from '#web/state/store.ts'
import { pulseRing } from '#web/ui/ring-pulse.ts'

export interface OrbitPromptProps {
  readonly map: MapLibre | null
}

const PULSE_SCALE = 2.4

let pulsed = false

function choose(slug: string) {
  const s = useStore.getState()
  if (placeSlug(s.place) === slug) {
    s.enter()
    return
  }
  void s.open(slug).then(() => {
    useStore.getState().enter()
  })
}

function TargetRing() {
  const pulse = useRef<HTMLSpanElement>(null)
  const nudge = useStore((s) => s.nudge)
  useEffect(() => {
    const element = pulse.current
    if (element === null || (pulsed && !nudge)) return
    pulsed = true
    pulseRing(element, PULSE_SCALE)
  }, [nudge])
  return (
    <span className="relative flex size-5 items-center justify-center">
      <span
        ref={pulse}
        className="absolute inset-0 rounded-full border-2 border-accent opacity-0 ease-reveal"
      />
      <span className="absolute inset-0 rounded-full border-2 border-accent" />
      <span className="size-1.5 rounded-full bg-text" />
    </span>
  )
}

const LABEL_SIDE: Readonly<Record<LabelSide, string>> = {
  left: 'right-full text-right',
  right: 'left-full text-left',
}

function meanLon(footprint: Polygon): number {
  const ring = footprint.coordinates[0]?.slice(1) ?? []
  return ring.reduce((sum, [lon = 0]) => sum + lon, 0) / Math.max(1, ring.length)
}

interface PlacePointProps {
  readonly entry: PlaceEntry
  readonly lines: readonly string[]
  readonly side: LabelSide
  readonly suggested: boolean
}

function PlacePoint({ entry, lines, side, suggested }: PlacePointProps) {
  const name = placeName(entry)
  const [first, ...rest] = lines
  return (
    <button
      type="button"
      aria-label={EN.map.openPlace(name)}
      onClick={(e) => {
        e.stopPropagation()
        choose(entry.slug)
      }}
      className="relative -m-2.5 flex size-10 items-center justify-center rounded-full"
    >
      {suggested ? <TargetRing /> : <span className="size-2 rounded-full bg-text-2" />}
      <span
        className={`halo absolute top-1/2 -translate-y-1/2 font-cond text-body font-medium whitespace-nowrap ${LABEL_SIDE[side]}`}
      >
        <span className={`block ${suggested ? 'text-text' : 'text-map-label'}`}>{first}</span>
        {rest.map((line) => (
          <span key={line} className="block text-text-2">
            {line}
          </span>
        ))}
      </span>
    </button>
  )
}

function labelLines(entry: PlaceEntry, changes: number | undefined): readonly string[] {
  const name = placeName(entry)
  const first = changes === undefined ? name : EN.map.placeChanges(name, changes)
  return entry.slug === STORY_PLACE.slug ? [first, EN.map.startHere] : [first]
}

function Points({ map }: { readonly map: MapLibre }) {
  const place = useStore((s) => s.place)
  const counts = usePlaceCounts()
  const now = useMinuteClock()
  const loaded = place.status === 'ready' ? place : null
  return PLACES.map((entry) => {
    const own = loaded?.data.slug === entry.slug ? loaded : null
    const suggested = entry.slug === STORY_PLACE.slug
    const swath = own === null || !suggested ? null : nextSwath(own.data.catalog, now)
    const side =
      swath !== null && meanLon(swath.footprint) > entry.centre[0] ? 'left' : entry.labelSide
    return (
      <MapMarker key={entry.slug} map={map} lonLat={entry.centre}>
        <PlacePoint
          entry={entry}
          lines={labelLines(
            entry,
            own === null ? counts.get(entry.slug) : own.story.changes.length,
          )}
          side={side}
          suggested={suggested}
        />
      </MapMarker>
    )
  })
}

export function OrbitPrompt({ map }: OrbitPromptProps) {
  const globe = useStore((s) => s.panel === 'orbit')
  return map === null || !globe ? null : <Points map={map} />
}
