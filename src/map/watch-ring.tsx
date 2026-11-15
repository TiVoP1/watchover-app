import type { Map as MapLibre } from 'maplibre-gl'
import { selectWatchObject } from '#web/business/motion.ts'
import { MapMarker } from '#web/map/map-marker.tsx'
import { useStore } from '#web/state/store.ts'

export function WatchRing({ map }: { readonly map: MapLibre }) {
  const place = useStore((s) => s.place)
  const watch = useStore(selectWatchObject)
  const selected = useStore((s) => watch !== null && s.selectedObject === watch)
  if (place.status !== 'ready' || watch === null) return null
  const object = place.data.objects?.objects.find((o) => o.osm === watch)
  if (object === undefined) return null
  return (
    <MapMarker map={map} lonLat={[object.lon, object.lat]}>
      <svg viewBox="0 0 48 48" className="pointer-events-none block size-12" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="none" strokeWidth="4" className="stroke-ink" />
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="none"
          strokeWidth="2"
          className={selected ? 'stroke-text' : 'stroke-text-2'}
        />
      </svg>
    </MapMarker>
  )
}
