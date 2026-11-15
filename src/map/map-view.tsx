import type { Feature, FeatureCollection, GeoJSON } from 'geojson'
import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type ImageSource,
  LngLat,
  Map as MapLibre,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type MapSourceDataEvent,
} from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type District,
  districtBounds,
  districtColour,
  districtGeojson,
  districtHeights,
  HEIGHT_M_PER_MM,
  heightsState,
  NEUTRAL_HEIGHT_M,
} from '#web/business/district.ts'
import { businessOverlay } from '#web/business/event.ts'
import { drawnOverlay } from '#web/business/ground-image.ts'
import type { Corners, PlaceData } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { firstLabelLayer, LABEL_FONT, LABEL_HALO_WIDTH_PX, loadBasemap } from '#web/map/basemap.ts'
import {
  frostMask,
  PARTIAL_MIN_SHARE,
  radarFrame,
  radarImage,
  transparentShare,
  useDrawn,
} from '#web/map/drawn.ts'
import {
  centreBounds,
  clampToBounds,
  FOG_OPACITY,
  fogRings,
  frameLabelSpot,
  frameOutline,
  neighbourSquares,
  placeMinZoom,
  type ViewPx,
  windowSquare,
} from '#web/map/frame.ts'
import { MapPins } from '#web/map/map-pins.tsx'
import {
  loadNightMercator,
  NIGHT_CEILING,
  NIGHT_CORNERS,
  NIGHT_EQUIRECT_URL,
  NIGHT_FLOOR,
  NIGHT_SIZE_PX,
} from '#web/map/night.ts'
import {
  ARC_CURVE,
  type CameraMove,
  type CameraTarget,
  cameraMove,
  cameraTarget,
  fadeIn,
  fadeOut,
  FLAT_ZOOM,
  mapStatus,
  NIGHT_ZOOM,
  nextSwath,
  orbitZoom,
  PLACE_ZOOM,
} from '#web/map/orbit.ts'
import { OrbitPrompt } from '#web/map/orbit-prompt.tsx'
import { clickTarget, focusOf } from '#web/map/pins.ts'
import { playFrame, playImage, playOrder, preloadImages } from '#web/map/play-frames.ts'
import { SatelliteMarker } from '#web/map/satellite-marker.tsx'
import { WatchRing } from '#web/map/watch-ring.tsx'
import { useMinuteClock } from '#web/state/clock.ts'
import { selectItem, selectStory, useStore } from '#web/state/store.ts'
import type { Story } from '#web/story/chapters.ts'
import { loadImage } from '#web/story/images.ts'
import { playable } from '#web/story/place-story.ts'
import { COLOR, MOTION, TEXT_PX } from '#web/tokens.ts'
import { formatNumber } from '#web/ui/format.ts'
import { prefersReducedMotion } from '#web/ui/reduced-motion.ts'

const RADAR = ['radar-0', 'radar-1'] as const
const MASK = 'mask'
const NO_RADAR = 'no-radar'
const FRAME_LABEL = 'frame-label'
const FOG = 'fog'
const NEIGHBOURS = 'neighbours'
const FRAME = 'frame'
const SWATH = 'swath'
const DISTRICT = 'district'
const GROUND = 'ground'
const OBJECT = 'object'
const FOCUS = 'focus'
const CASING = '-casing'
const BLANK_IMAGE_URL = '/blank.png'
const MARKER_SELECTOR = '.maplibregl-marker'
const FRAME_WIDTH_PX = 1.5
const NEIGHBOUR_WIDTH_PX = 1
const NEIGHBOUR_DASH = [3, 3]
const SWATH_WIDTH_PX = 1.5
const SWATH_DASH = [3, 2]
const OUTLINE_WIDTH_PX = 2
const OUTLINE_CASING_WIDTH_PX = 5
const LABEL_GAP_PX = 6
const LABEL_OFFSET_EM = 0.4
const LABEL_MAX_WIDTH_EM = 100
const LABEL_CSS_FONT = `500 ${String(TEXT_PX.body)}px 'Fira Sans Condensed'`
const LABEL_LINE = 1.2
const COVERAGE_SAMPLE_PX = 64
const FROST_MASK_OPACITY = 0.4
const BUSINESS_RADAR_BRIGHTNESS = 0.35
const GROUND_OPACITY = 0.9
const RADAR_VISIBLE = fadeIn(PLACE_ZOOM)
const SWATH_VISIBLE = fadeOut(PLACE_ZOOM)
const FOG_VISIBLE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  PLACE_ZOOM[0],
  0,
  PLACE_ZOOM[1],
  ['get', 'opacity'],
]
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const EMPTY_DISTRICT: District = { type: 'FeatureCollection', features: [] }
const UNIT_SQUARE: Corners = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
]

type MutableCorners = [[number, number], [number, number], [number, number], [number, number]]
type Buffer = 0 | 1

interface CameraState {
  readonly moving: boolean
  readonly idle: boolean
  readonly settledZoom: number
}

const mutable = (c: Corners): MutableCorners => [
  [c[0][0], c[0][1]],
  [c[1][0], c[1][1]],
  [c[2][0], c[2][1]],
  [c[3][0], c[3][1]],
]

const setGeojson = (map: MapLibre, id: string, data: GeoJSON) => {
  void map.getSource<GeoJSONSource>(id)?.setData(data)
}

const collection = (feature: Feature | null): FeatureCollection =>
  feature === null ? EMPTY : { type: 'FeatureCollection', features: [feature] }

function addImageLayer(
  map: MapLibre,
  id: string,
  before: string | undefined,
  opacity: number | ExpressionSpecification,
) {
  map.addSource(id, { type: 'image', url: BLANK_IMAGE_URL, coordinates: mutable(UNIT_SQUARE) })
  map.addLayer(
    {
      id,
      type: 'raster',
      source: id,
      paint: {
        'raster-opacity': opacity,
        'raster-opacity-transition': { duration: MOTION.frameMs, delay: 0 },
        'raster-fade-duration': 0,
        'raster-resampling': 'linear',
      },
    },
    before,
  )
}

function addNoRadarLayer(map: MapLibre, before: string | undefined) {
  map.addSource(NO_RADAR, { type: 'geojson', data: EMPTY })
  map.addLayer(
    {
      id: NO_RADAR,
      type: 'fill',
      source: NO_RADAR,
      paint: { 'fill-color': COLOR.bg, 'fill-opacity': fadeIn(PLACE_ZOOM, FOG_OPACITY[0]) },
    },
    before,
  )
}

function addFrameLabelLayer(map: MapLibre) {
  map.addSource(FRAME_LABEL, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: FRAME_LABEL,
    type: 'symbol',
    source: FRAME_LABEL,
    minzoom: PLACE_ZOOM[0],
    layout: {
      'text-field': ['get', 'text'],
      'text-font': [LABEL_FONT],
      'text-size': TEXT_PX.body,
      'text-anchor': ['get', 'anchor'],
      'text-offset': [
        'match',
        ['get', 'anchor'],
        ['top-left', 'top-right'],
        ['literal', [0, LABEL_OFFSET_EM]],
        ['literal', [0, -LABEL_OFFSET_EM]],
      ],
      'text-max-width': LABEL_MAX_WIDTH_EM,
      'text-allow-overlap': true,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': COLOR.mapLabel,
      'text-halo-color': COLOR.bg,
      'text-halo-width': LABEL_HALO_WIDTH_PX,
      'text-opacity': fadeIn(PLACE_ZOOM),
    },
  })
}

function labelSize(text: string): ViewPx {
  const context = document.createElement('canvas').getContext('2d')
  if (context === null) return { width: 0, height: TEXT_PX.body * LABEL_LINE }
  context.font = LABEL_CSS_FONT
  return { width: context.measureText(text).width, height: TEXT_PX.body * LABEL_LINE }
}

const coverage = new Map<string, Promise<boolean>>()

function partlyEmpty(url: string): Promise<boolean> {
  const known = coverage.get(url)
  if (known !== undefined) return known
  const image = new Image()
  image.src = url
  const result = image.decode().then(() => {
    const canvas = document.createElement('canvas')
    canvas.width = COVERAGE_SAMPLE_PX
    canvas.height = COVERAGE_SAMPLE_PX
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context === null) return false
    context.drawImage(image, 0, 0, COVERAGE_SAMPLE_PX, COVERAGE_SAMPLE_PX)
    const pixels = context.getImageData(0, 0, COVERAGE_SAMPLE_PX, COVERAGE_SAMPLE_PX).data
    return transparentShare(pixels) >= PARTIAL_MIN_SHARE
  })
  result.catch(() => {
    coverage.delete(url)
  })
  coverage.set(url, result)
  return result
}

function addNightLayer(map: MapLibre, before: string | undefined) {
  map.addSource('night', { type: 'image', coordinates: mutable(NIGHT_CORNERS) })
  map.addLayer(
    {
      id: 'night',
      type: 'raster',
      source: 'night',
      maxzoom: NIGHT_ZOOM[1],
      paint: {
        'raster-opacity': fadeOut(NIGHT_ZOOM),
        'raster-saturation': -1,
        'raster-brightness-min': NIGHT_FLOOR,
        'raster-brightness-max': NIGHT_CEILING,
        'raster-fade-duration': 0,
      },
    },
    before,
  )
}

function addWatchLayers(map: MapLibre, before: string | undefined) {
  for (const id of [FOG, NEIGHBOURS, FRAME, SWATH])
    map.addSource(id, { type: 'geojson', data: EMPTY })
  map.addLayer(
    {
      id: FOG,
      type: 'fill',
      source: FOG,
      paint: { 'fill-color': COLOR.bg, 'fill-opacity': FOG_VISIBLE },
    },
    before,
  )
  map.addLayer(
    {
      id: NEIGHBOURS,
      type: 'line',
      source: NEIGHBOURS,
      paint: {
        'line-color': COLOR.control,
        'line-width': NEIGHBOUR_WIDTH_PX,
        'line-dasharray': NEIGHBOUR_DASH,
        'line-opacity': fadeIn(PLACE_ZOOM),
      },
    },
    before,
  )
  map.addLayer(
    {
      id: FRAME,
      type: 'line',
      source: FRAME,
      paint: {
        'line-color': COLOR.accent,
        'line-width': FRAME_WIDTH_PX,
        'line-opacity': fadeIn(PLACE_ZOOM),
      },
    },
    before,
  )
  map.addLayer(
    {
      id: SWATH,
      type: 'line',
      source: SWATH,
      paint: {
        'line-color': COLOR.control,
        'line-width': SWATH_WIDTH_PX,
        'line-dasharray': SWATH_DASH,
        'line-opacity': 0,
        'line-opacity-transition': { duration: MOTION.passMs, delay: 0 },
      },
    },
    before,
  )
}

function addDistrictLayer(map: MapLibre, before: string | undefined) {
  map.addSource(DISTRICT, { type: 'geojson', data: EMPTY_DISTRICT, promoteId: 'osm' })
  map.addLayer(
    {
      id: DISTRICT,
      type: 'fill-extrusion',
      source: DISTRICT,
      minzoom: PLACE_ZOOM[1],
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': districtColour(null),
        'fill-extrusion-height': [
          '+',
          NEUTRAL_HEIGHT_M,
          ['*', HEIGHT_M_PER_MM, ['number', ['feature-state', 'mm'], 0]],
        ],
        'fill-extrusion-vertical-gradient': false,
      },
    },
    before,
  )
}

function addOutlineLayers(
  map: MapLibre,
  id: string,
  before: string | undefined,
  colour: string | ExpressionSpecification,
) {
  map.addSource(id, { type: 'geojson', data: EMPTY })
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const
  map.addLayer(
    {
      id: `${id}${CASING}`,
      type: 'line',
      source: id,
      layout,
      paint: { 'line-color': COLOR.ink, 'line-width': OUTLINE_CASING_WIDTH_PX },
    },
    before,
  )
  map.addLayer(
    {
      id,
      type: 'line',
      source: id,
      layout,
      paint: { 'line-color': colour, 'line-width': OUTLINE_WIDTH_PX },
    },
    before,
  )
}

function addLayers(map: MapLibre, before: string | undefined) {
  addNightLayer(map, before)
  addNoRadarLayer(map, before)
  addImageLayer(map, RADAR[0], before, RADAR_VISIBLE)
  addImageLayer(map, RADAR[1], before, 0)
  addImageLayer(map, MASK, before, 0)
  addImageLayer(map, GROUND, before, 0)
  addWatchLayers(map, before)
  addDistrictLayer(map, before)
  addOutlineLayers(map, OBJECT, before, COLOR.text)
  addOutlineLayers(map, FOCUS, before, ['get', 'colour'])
  addFrameLabelLayer(map)
}

function showNight(map: MapLibre, cancelled: () => boolean) {
  void loadNightMercator(NIGHT_EQUIRECT_URL, NIGHT_SIZE_PX).then(
    (image) => {
      if (!cancelled()) map.getSource<ImageSource>('night')?.updateImage({ image })
    },
    () => {
      if (!cancelled()) map.setLayoutProperty('night', 'visibility', 'none')
    },
  )
}

function clearLimits(map: MapLibre) {
  map.setTransformConstrain(null)
  map.setMinZoom(null)
}

function applyLimits(map: MapLibre, corners: Corners, view: ViewPx) {
  const bounds = centreBounds(corners)
  const minZoom = Math.max(placeMinZoom(corners, view), FLAT_ZOOM[1])
  map.setMinZoom(minZoom)
  map.setTransformConstrain((lngLat, zoom) => {
    const [lon, lat] = clampToBounds(bounds, [lngLat.lng, lngLat.lat])
    return {
      center: new LngLat(lon, lat),
      zoom: Math.min(map.getMaxZoom(), Math.max(minZoom, zoom)),
    }
  })
}

function moveCamera(map: MapLibre, target: CameraTarget, move: CameraMove, orbit: number) {
  const { shot } = target
  const duration = move === 'jump' ? 0 : MOTION.flyMs
  const path = move === 'arc' ? { curve: ARC_CURVE, minZoom: orbit } : { linear: true }
  if (shot.kind === 'globe') {
    const [lon, lat] = shot.center
    map.flyTo({ center: [lon, lat], zoom: shot.zoom, pitch: 0, bearing: 0, duration, ...path })
    return
  }
  const padding = { ...shot.padding }
  map.fitBounds(shot.bounds, { padding, pitch: shot.pitch, bearing: 0, duration, ...path })
}

function onMapClick(e: MapMouseEvent) {
  const origin = e.originalEvent.target
  const onMarker = origin instanceof Element && origin.closest(MARKER_SELECTOR) !== null
  if (onMarker || (origin instanceof Node && !origin.isConnected)) return
  const s = useStore.getState()
  if (s.place.status !== 'ready' || s.panel === 'orbit') return
  if (s.mode !== 'people' || s.tool !== 'none') return
  const hit = clickTarget(s.place.story, s.place.data, [e.lngLat.lng, e.lngLat.lat])
  if (hit.kind === 'item') s.openItem(hit.id)
  else s.setNotice(hit.kind === 'none' ? null : hit.kind)
}

function onDistrictClick(e: MapLayerMouseEvent) {
  const id = e.features?.[0]?.id
  if (typeof id !== 'string') return
  const s = useStore.getState()
  s.select(s.selectedObject === id ? null : id)
}

function frameLabelText(story: Story): string | null {
  const km = story.viewKm
  const pixel = story.pixelM
  if (km === null || pixel === null) return null
  return EN.map.frameLabel(formatNumber(km.width), formatNumber(km.height), formatNumber(pixel))
}

function placeFrameLabel(map: MapLibre, corners: Corners, text: string): () => void {
  const size = labelSize(text)
  let shown: string | null = null
  const place = () => {
    const box = map.getContainer()
    const view = { width: box.clientWidth, height: box.clientHeight }
    const spot = frameLabelSpot(
      corners,
      ([lon, lat]) => map.project([lon, lat]),
      view,
      size,
      LABEL_GAP_PX,
    )
    const key = spot === null ? '' : spot.anchor
    if (key === shown) return
    shown = key
    setGeojson(
      map,
      FRAME_LABEL,
      spot === null
        ? EMPTY
        : {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [...spot.lonLat] },
            properties: { text, anchor: spot.anchor },
          },
    )
  }
  let removed = false
  const onRemove = () => {
    removed = true
  }
  map.on('remove', onRemove)
  place()
  map.on('move', place)
  return () => {
    map.off('move', place)
    map.off('remove', onRemove)
    if (!removed) setGeojson(map, FRAME_LABEL, EMPTY)
  }
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null)
  const active = useRef<Buffer>(0)
  const lastTarget = useRef<CameraTarget | null>(null)
  const onArrival = useRef<(() => void) | null>(null)
  const shown = useRef(new Map<string, number>())
  const [map, setMap] = useState<MapLibre | null>(null)
  const [camera, setCamera] = useState<CameraState>({
    moving: false,
    idle: false,
    settledZoom: 0,
  })
  const [drawnUrl, setDrawnUrl] = useState<string | null>(null)
  const place = useStore((s) => s.place)
  const story = useStore(selectStory)
  const item = useStore(selectItem)
  const panel = useStore((s) => s.panel)
  const frame = useStore((s) => s.frame)
  const mode = useStore((s) => s.mode)
  const falseColour = useStore((s) => s.falseColour)
  const selectedObject = useStore((s) => s.selectedObject)
  const autoDive = useStore((s) => s.autoDive)
  const playing = useStore((s) => s.playing)
  const inPlay = useStore((s) => s.playing || s.paused)
  const now = useMinuteClock()
  const globe = panel === 'orbit'
  const business = mode === 'business'
  const data = place.status === 'ready' ? place.data : null

  const district = useMemo(() => {
    if (data === null || data.footprints === null || data.objects === null) return null
    return districtGeojson(data.footprints, data.objects, data.nullCheck)
  }, [data])

  const districtBox = useMemo(
    () =>
      district === null || data?.objects == null ? null : districtBounds(district, data.objects),
    [district, data],
  )

  const ground = useMemo(
    () => (data === null || !business ? null : businessOverlay(data, story, selectedObject)),
    [data, business, story, selectedObject],
  )

  const shownFrame = useMemo(() => {
    if (data === null || story === null) return null
    const radar = data.radar
    if (inPlay && !business && item === null && radar !== null) {
      return playFrame(story, radar.frames, frame)
    }
    return radarFrame({ data, story, frame, item, business })
  }, [data, story, frame, item, business, inPlay])
  const wanted = useMemo(() => {
    if (data === null || shownFrame === null) return null
    const light = playing && !falseColour ? playImage(data, shownFrame) : null
    return light ?? radarImage(data, shownFrame, falseColour)
  }, [data, shownFrame, falseColour, playing])
  const wantedUrl = wanted?.url ?? null

  const mask = useMemo(
    () =>
      data === null || story === null ? null : frostMask({ data, story, frame, item, business }),
    [data, story, frame, item, business],
  )
  const maskUrl = mask === null || wantedUrl !== drawnUrl ? null : mask.url

  const focus = useMemo(
    () => (data === null || item === null ? null : focusOf(item, data)),
    [data, item],
  )

  const objectRing = useMemo((): GeoJSON => {
    const feature = data?.footprints?.features.find((f) => f.properties.osm === selectedObject)
    return feature === undefined ? EMPTY : { type: 'FeatureCollection', features: [feature] }
  }, [data, selectedObject])

  useEffect(() => {
    let cancelled = false
    let created: MapLibre | null = null
    let unsubscribe = () => {}
    void loadBasemap().then((style) => {
      const box = container.current
      if (cancelled || box === null) return
      const create = (first: PlaceData) => {
        const { lon, lat } = first.catalog.place
        const next = new MapLibre({
          container: box,
          style,
          attributionControl: false,
          center: [lon, lat],
          zoom: orbitZoom(box.clientWidth, box.clientHeight, lat),
          dragRotate: false,
          pitchWithRotate: false,
        })
        created = next
        next.on('load', () => {
          addLayers(next, firstLabelLayer(style))
          showNight(next, () => cancelled)
          next.on('movestart', () => {
            setCamera((c) => ({ ...c, moving: true, idle: false }))
          })
          next.on('moveend', () => {
            setCamera((c) => ({ ...c, moving: false, settledZoom: next.getZoom() }))
          })
          next.on('idle', () => {
            setCamera((c) => (c.idle ? c : { ...c, idle: true }))
          })
          next.on('click', onMapClick)
          next.on('click', DISTRICT, onDistrictClick)
          next.on('mouseenter', DISTRICT, () => {
            next.getCanvas().style.cursor = 'pointer'
          })
          next.on('mouseleave', DISTRICT, () => {
            next.getCanvas().style.cursor = ''
          })
          setMap(next)
        })
      }
      const current = useStore.getState().place
      if (current.status === 'ready') {
        create(current.data)
        return
      }
      unsubscribe = useStore.subscribe((s) => {
        if (s.place.status !== 'ready' || created !== null) return
        unsubscribe()
        create(s.place.data)
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
      created?.remove()
    }
  }, [])

  useEffect(() => {
    if (map === null || data === null) return
    const corners = data.radar?.corners_lonlat ?? null
    setGeojson(map, NO_RADAR, corners === null ? EMPTY : windowSquare(corners))
    setGeojson(map, FOG, corners === null ? EMPTY : fogRings(corners))
    setGeojson(map, NEIGHBOURS, corners === null ? EMPTY : neighbourSquares(corners))
    setGeojson(map, FRAME, corners === null ? EMPTY : frameOutline(corners))
    for (const id of RADAR) {
      map.setPaintProperty(id, 'raster-opacity', 0)
      if (corners !== null) map.getSource<ImageSource>(id)?.setCoordinates(mutable(corners))
    }
    useDrawn.getState().setRadar(null)
  }, [map, data])

  useEffect(() => {
    const corners = data?.radar?.corners_lonlat
    if (map === null || wanted === null || corners === undefined) return
    const previous = active.current
    const next: Buffer = previous === 0 ? 1 : 0
    const source = map.getSource<ImageSource>(RADAR[next])
    const show = () => {
      map.setPaintProperty(RADAR[next], 'raster-opacity', RADAR_VISIBLE)
      map.setPaintProperty(RADAR[previous], 'raster-opacity', 0)
      active.current = next
      useDrawn.getState().setRadar(wanted)
      partlyEmpty(wanted.url).then(
        (partial) => {
          useDrawn.getState().setPartial(wanted.url, partial)
        },
        () => undefined,
      )
      setDrawnUrl(wanted.url)
      setCamera((c) => ({ ...c, idle: false }))
    }
    if (playing) {
      let live = true
      loadImage(wanted.url).then(
        (image) => {
          if (!live) return
          source?.updateImage({ image, coordinates: mutable(corners) })
          show()
        },
        () => undefined,
      )
      return () => {
        live = false
      }
    }
    const swap = (e: MapSourceDataEvent) => {
      if (e.sourceId !== RADAR[next] || !e.isSourceLoaded) return
      map.off('sourcedata', swap)
      show()
    }
    map.on('sourcedata', swap)
    source?.updateImage({ url: wanted.url, coordinates: mutable(corners) })
    return () => {
      map.off('sourcedata', swap)
    }
  }, [map, data, wanted, playing])

  const sharp = item !== null
  useEffect(() => {
    if (map === null) return
    for (const id of RADAR)
      map.setPaintProperty(id, 'raster-resampling', sharp ? 'nearest' : 'linear')
  }, [map, sharp])

  useEffect(() => {
    if (map === null || data === null) return
    const corners = data.events?.corners_lonlat
    const visible = maskUrl !== null && corners !== undefined
    if (visible) {
      map.getSource<ImageSource>(MASK)?.updateImage({ url: maskUrl, coordinates: mutable(corners) })
    }
    map.setPaintProperty(
      MASK,
      'raster-opacity',
      visible ? fadeIn(PLACE_ZOOM, FROST_MASK_OPACITY) : 0,
    )
    useDrawn.getState().setMask(visible)
  }, [map, data, maskUrl])

  useEffect(() => {
    if (map === null || data === null) return
    const swath = globe ? nextSwath(data.catalog, now) : null
    const outline: GeoJSON =
      swath === null ? EMPTY : { type: 'Feature', geometry: swath.footprint, properties: {} }
    setGeojson(map, SWATH, outline)
    map.setPaintProperty(SWATH, 'line-opacity', swath === null ? 0 : SWATH_VISIBLE)
  }, [map, data, now, globe])

  useEffect(() => {
    if (map === null) return
    setGeojson(map, FOCUS, collection(focus?.outline ?? null))
  }, [map, focus])

  useEffect(() => {
    const corners = data?.radar?.corners_lonlat
    const text = story === null ? null : frameLabelText(story)
    if (map === null || globe || corners === undefined || text === null) return
    return placeFrameLabel(map, corners, text)
  }, [map, data, story, globe])

  useEffect(() => {
    if (map === null) return
    setGeojson(map, OBJECT, business ? objectRing : EMPTY)
  }, [map, objectRing, business])

  useEffect(() => {
    if (map === null) return
    map.removeFeatureState({ source: DISTRICT })
    shown.current.clear()
    setGeojson(map, DISTRICT, district ?? EMPTY_DISTRICT)
  }, [map, district])

  useEffect(() => {
    if (map === null) return
    map.setPaintProperty(DISTRICT, 'fill-extrusion-color', districtColour(selectedObject))
  }, [map, selectedObject])

  useEffect(() => {
    if (map === null) return
    map.setLayoutProperty(DISTRICT, 'visibility', business ? 'visible' : 'none')
    const dimmed = business && (district !== null || ground !== null)
    const brightness = dimmed ? BUSINESS_RADAR_BRIGHTNESS : 1
    for (const id of RADAR) map.setPaintProperty(id, 'raster-brightness-max', brightness)
  }, [map, business, district, ground])

  useEffect(() => {
    if (map === null) return
    map.setPaintProperty(GROUND, 'raster-opacity', 0)
    if (ground === null) return
    let cancelled = false
    drawnOverlay(ground).then(
      ({ url, corners }) => {
        if (cancelled) return
        map.getSource<ImageSource>(GROUND)?.updateImage({ url, coordinates: mutable(corners) })
        map.setPaintProperty(GROUND, 'raster-opacity', fadeIn(PLACE_ZOOM, GROUND_OPACITY))
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [map, ground])

  useEffect(() => {
    if (map === null || data === null || !business) return
    const objects = data.objects
    const time = data.radar?.frames[frame]?.time
    if (district === null || objects === null || time === undefined) return
    const state = heightsState(objects, time)
    if (state === null) return
    const target = districtHeights(district, objects, state)
    const start = new Map(shown.current)
    const apply = (k: number) => {
      for (const [osm, mm] of target) {
        const from = start.get(osm) ?? 0
        const value = from + (mm - from) * k
        shown.current.set(osm, value)
        map.setFeatureState({ source: DISTRICT, id: osm }, { mm: value })
      }
    }
    if (prefersReducedMotion()) {
      apply(1)
      return
    }
    let raf = 0
    let t0: number | null = null
    const tick = (at: number) => {
      t0 ??= at
      const k = Math.min(1, (at - t0) / MOTION.frameMs)
      apply(k)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [map, data, district, business, frame])

  useEffect(() => {
    const box = container.current
    if (map === null || box === null || data === null || story === null) return
    const { lon, lat } = data.catalog.place
    const target = cameraTarget({
      slug: data.slug,
      centre: [lon, lat],
      corners: data.radar?.corners_lonlat ?? null,
      panel,
      mode,
      focus: item === null ? null : { id: item.id, bbox: item.bbox },
      district: districtBox,
      inset: story.chapters.length > 0 && playable(data),
      widthPx: box.clientWidth,
      heightPx: box.clientHeight,
    })
    const previous = lastTarget.current
    if (previous?.key === target.key) return
    lastTarget.current = target
    const corners = data.radar?.corners_lonlat
    const view = { width: box.clientWidth, height: box.clientHeight }
    if (onArrival.current !== null) map.off('moveend', onArrival.current)
    onArrival.current = null
    map.stop()
    if (!target.limits || corners === undefined) {
      clearLimits(map)
    } else {
      const arrive = () => {
        onArrival.current = null
        applyLimits(map, corners, view)
      }
      onArrival.current = arrive
      map.once('moveend', arrive)
    }
    const move = cameraMove(previous, target, useStore.getState().playing)
    moveCamera(map, target, move, orbitZoom(view.width, view.height, lat))
  }, [map, data, story, panel, mode, item, districtBox])

  const status = mapStatus({
    mapReady: map !== null,
    placeReady: data !== null,
    globe,
    moving: camera.moving,
    idle: camera.idle,
    wantedUrl,
    drawnUrl,
  })

  useEffect(() => {
    if (!autoDive || status !== 'orbit') return
    const timer = window.setTimeout(() => {
      const s = useStore.getState()
      s.setAutoDive(false)
      s.enter()
    }, MOTION.passMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [autoDive, status])

  const landed = !globe && camera.settledZoom >= PLACE_ZOOM[1]

  useEffect(() => {
    if (!landed || data === null || story === null) return
    return preloadImages(playOrder(data, story, mode))
  }, [landed, data, story, mode])

  return (
    <div
      className="absolute inset-0 bg-bg"
      role="region"
      aria-label={data?.catalog.place.name}
      data-map-status={status}
    >
      <div ref={container} className="h-full w-full" />
      {map === null ? null : (
        <>
          <OrbitPrompt map={map} />
          <SatelliteMarker map={map} active={globe} />
          {landed && !business ? <MapPins map={map} /> : null}
          {landed && business ? <WatchRing map={map} /> : null}
        </>
      )}
    </div>
  )
}
