import { type GeoJSONSource, type Map as MapLibre, Marker } from 'maplibre-gl'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LonLat } from '#web/film/geo.ts'
import { EN } from '#web/i18n/en.ts'
import { nextSwath } from '#web/map/orbit.ts'
import {
  entryIndex,
  type Flank,
  groundPoint,
  loadOrbitTrack,
  type OrbitTrack,
  playIndex,
  type Revolution,
  revolutionAt,
  SATELLITE_SPEEDUP,
  swathFlank,
  trackLine,
} from '#web/map/orbit-track.ts'
import {
  type Box,
  type LabelSide,
  type LabelSize,
  labelSide,
  type ScreenPoint,
} from '#web/map/satellite-label.ts'
import { satelliteSprite } from '#web/map/satellite-sprite.ts'
import { useMinuteClock } from '#web/state/clock.ts'
import { type StoreState, useStore } from '#web/state/store.ts'
import { COLOR } from '#web/tokens.ts'
import { useReducedMotion } from '#web/ui/reduced-motion.ts'

const TRACK = 'satellite-track'
const TRACK_WIDTH_PX = 1
const HEADING_STEP = 0.5
const TAKEN_REFRESH_MS = 500
const STILL_AFTER_MS = 5000
const COVERED = 'maplibregl-marker-covered'

export interface SatelliteMarkerProps {
  readonly map: MapLibre | null
  readonly active: boolean
}

interface Flight {
  readonly track: OrbitTrack
  readonly place: LonLat
  readonly entry: number
  readonly start: number
  readonly first: Revolution
}

interface Caption {
  readonly flight: Flight
  readonly side: LabelSide
  readonly shown: boolean
}

const LABEL_SIDE: Readonly<Record<Flank, LabelSide>> = { west: 'left', east: 'right' }

const LABEL_PLACE: Readonly<Record<LabelSide, string>> = {
  left: 'right-full mr-2 text-right',
  right: 'left-full ml-2',
}

const selectCatalog = (s: StoreState) => (s.place.status === 'ready' ? s.place.data.catalog : null)

const lngLat = ([lon, lat]: LonLat) => ({ lon, lat })

const headingDeg = (at: ScreenPoint, ahead: ScreenPoint): number =>
  (Math.atan2(ahead.x - at.x, at.y - ahead.y) * 180) / Math.PI

const firstSymbolLayer = (map: MapLibre): string | undefined =>
  map.getLayersOrder().find((id) => map.getLayer(id)?.type === 'symbol')

function markerElement(): HTMLDivElement {
  const element = document.createElement('div')
  element.className = 'pointer-events-none'
  return element
}

function takenBoxes(map: MapLibre, own: HTMLElement): Box[] {
  const origin = map.getContainer().getBoundingClientRect()
  const boxes: Box[] = []
  for (const marker of map.getCanvasContainer().querySelectorAll('.maplibregl-marker')) {
    if (marker === own || marker.classList.contains(COVERED)) continue
    for (const part of [marker, ...marker.querySelectorAll('*')]) {
      const r = part.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      boxes.push({
        left: r.left - origin.left,
        top: r.top - origin.top,
        right: r.right - origin.left,
        bottom: r.bottom - origin.top,
      })
    }
  }
  return boxes
}

export function SatelliteMarker({ map, active }: SatelliteMarkerProps): ReactNode {
  const catalog = useStore(selectCatalog)
  const now = useMinuteClock()
  const still = useReducedMotion()
  const [track, setTrack] = useState<OrbitTrack | null>(null)
  const [element] = useState(markerElement)
  const [caption, setCaption] = useState<Caption | null>(null)
  const sprite = useRef<HTMLImageElement>(null)
  const words = useRef<HTMLParagraphElement>(null)
  const url = useMemo(() => (active ? satelliteSprite() : null), [active])

  const place = useMemo((): LonLat | null => {
    if (catalog === null) return null
    return [catalog.place.lon, catalog.place.lat]
  }, [catalog])

  const flank = useMemo((): Flank => {
    const swath = catalog === null ? null : nextSwath(catalog, now)
    return swath === null || place === null ? 'west' : swathFlank(swath.footprint, place)
  }, [catalog, place, now])

  const flight = useMemo((): Flight | null => {
    if (track === null || place === null) return null
    const entry = entryIndex(track, place, flank)
    const start = playIndex(track, entry, still ? STILL_AFTER_MS : 0)
    return { track, place, entry, start, first: revolutionAt(track, start, place) }
  }, [track, place, flank, still])

  const current = caption !== null && caption.flight === flight ? caption : null
  const side = current?.side ?? LABEL_SIDE[flight?.first.flank ?? 'west']
  const shown = current?.shown ?? true

  useEffect(() => {
    if (!active || track !== null) return
    let live = true
    loadOrbitTrack().then(
      (loaded) => {
        if (live) setTrack(loaded)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [active, track])

  useEffect(() => {
    const image = sprite.current
    const label = words.current
    if (!active || map === null || flight === null || image === null || label === null) return
    const { track: orbit, entry, start } = flight
    let removed = false
    const onRemove = () => {
      removed = true
    }
    map.on('remove', onRemove)
    const marker = new Marker({ element, opacityWhenCovered: 0, subpixelPositioning: true })
      .setLngLat(lngLat(groundPoint(orbit, start)))
      .addTo(map)
    map.addSource(TRACK, { type: 'geojson', data: trackLine(orbit, flight.first) })
    map.addLayer(
      {
        id: TRACK,
        type: 'line',
        source: TRACK,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLOR.control, 'line-width': TRACK_WIDTH_PX },
      },
      firstSymbolLayer(map),
    )
    let size: LabelSize = { reachPx: 0, heightPx: 0 }
    const measure = () => {
      const half = element.offsetWidth / 2
      const reachPx = Math.max(half - label.offsetLeft, label.offsetLeft + label.offsetWidth - half)
      size = { reachPx, heightPx: label.offsetHeight }
    }
    const labelSize = new ResizeObserver(measure)
    labelSize.observe(label)
    measure()
    let view: Box = { left: 0, top: 0, right: 0, bottom: 0 }
    const onResize = () => {
      const box = map.getContainer()
      view = { left: 0, top: 0, right: box.clientWidth, bottom: box.clientHeight }
    }
    onResize()
    map.on('resize', onResize)
    let taken: readonly Box[] = []
    let takenAt = Number.NEGATIVE_INFINITY
    const onMove = () => {
      takenAt = Number.NEGATIVE_INFINITY
    }
    map.on('move', onMove)
    let revolution = flight.first
    let said: Omit<Caption, 'flight'> | null = null
    const show = (index: number, refresh: boolean) => {
      if (index < revolution.from || index >= revolution.to) {
        revolution = revolutionAt(orbit, index, flight.place)
        void map.getSource<GeoJSONSource>(TRACK)?.setData(trackLine(orbit, revolution))
      }
      if (refresh) taken = takenBoxes(map, element)
      const here = groundPoint(orbit, index)
      marker.setLngLat(lngLat(here))
      const at = map.project(lngLat(here))
      const ahead = map.project(lngLat(groundPoint(orbit, index + HEADING_STEP)))
      image.style.transform = `rotate(${headingDeg(at, ahead)}deg)`
      const preferred = LABEL_SIDE[revolution.flank]
      const chosen = labelSide(preferred, at, size, view, taken)
      const next = { side: chosen ?? said?.side ?? preferred, shown: chosen !== null }
      if (said !== null && said.side === next.side && said.shown === next.shown) return
      said = next
      setCaption({ flight, ...next })
    }
    const hold = () => {
      show(start, true)
    }
    let frame = 0
    if (still) {
      hold()
      map.on('moveend', hold)
    } else {
      let shownAt: number | null = null
      const tick = (nowMs: number) => {
        shownAt ??= nowMs
        const refresh = nowMs - takenAt > TAKEN_REFRESH_MS
        if (refresh) takenAt = nowMs
        show(playIndex(orbit, entry, nowMs - shownAt), refresh)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    return () => {
      cancelAnimationFrame(frame)
      labelSize.disconnect()
      map.off('moveend', hold)
      map.off('move', onMove)
      map.off('resize', onResize)
      map.off('remove', onRemove)
      marker.remove()
      if (removed) return
      if (map.getLayer(TRACK)) map.removeLayer(TRACK)
      if (map.getSource(TRACK)) map.removeSource(TRACK)
    }
  }, [active, map, flight, still, element])

  if (!active || map === null || flight === null || url === null) return null
  return createPortal(
    <div
      className={`transition-opacity duration-(--dur-ui) ease-ui ${shown ? 'opacity-100' : 'opacity-0'}`}
    >
      <img ref={sprite} src={url} alt="" className="block w-18 max-w-none" />
      <p
        ref={words}
        className={`halo absolute top-1/2 -translate-y-1/2 font-cond text-body font-medium whitespace-nowrap text-map-label ${LABEL_PLACE[side]}`}
      >
        <span className="block">{EN.satellite.name}</span>
        <span className="block">
          {still ? EN.satellite.scaleStill : EN.satellite.scale(SATELLITE_SPEEDUP)}
        </span>
      </p>
    </div>,
    element,
  )
}
