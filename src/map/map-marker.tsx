import { type Map as MapLibre, Marker, type PositionAnchor } from 'maplibre-gl'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LonLat } from '#web/story/where.ts'

export interface MapMarkerProps {
  readonly map: MapLibre
  readonly lonLat: LonLat
  readonly anchor?: PositionAnchor
  readonly offsetPx?: readonly [x: number, y: number]
  readonly children: ReactNode
}

const NO_OFFSET = [0, 0] as const
const COVERED_CLASS = 'maplibregl-marker-covered'

export function MapMarker({
  map,
  lonLat,
  anchor = 'center',
  offsetPx = NO_OFFSET,
  children,
}: MapMarkerProps) {
  const [element] = useState(() => document.createElement('div'))
  const [lon, lat] = lonLat
  const [x, y] = offsetPx
  useEffect(() => {
    const covered = new MutationObserver(() => {
      element.style.visibility = element.classList.contains(COVERED_CLASS) ? 'hidden' : ''
    })
    covered.observe(element, { attributes: true, attributeFilter: ['class'] })
    const marker = new Marker({ element, anchor, offset: [x, y], opacityWhenCovered: 0 })
      .setLngLat([lon, lat])
      .addTo(map)
    return () => {
      covered.disconnect()
      marker.remove()
    }
  }, [map, element, anchor, x, y, lon, lat])
  return createPortal(children, element)
}
