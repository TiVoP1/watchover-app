import { heightsSource } from '#web/business/district.ts'
import { eventPlate } from '#web/business/event.ts'
import { groundExample, groundOverlay } from '#web/business/ground.ts'
import type { Direction, PlaceData, RadarMeta } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { type RadarImage, useDrawn } from '#web/map/drawn.ts'
import { selectStory, useStore } from '#web/state/store.ts'
import { formatUtcDate, formatUtcTime } from '#web/ui/format.ts'

interface PlateProps {
  readonly lines: readonly string[]
  readonly attribution: string
}

interface Notes {
  readonly mask: boolean
  readonly partial: boolean
  readonly layer: string | null
}

function Plate({ lines, attribution }: PlateProps) {
  return (
    <div className="absolute bottom-3 left-3 rounded-md border border-line bg-panel px-3 py-2">
      {lines.map((line) => (
        <p key={line} className="tnum text-meta text-text-2">
          {line}
        </p>
      ))}
      <p className="text-meta text-text-3">{attribution}</p>
    </div>
  )
}

const directionWord = (direction: Direction): string =>
  direction === 'ASCENDING' ? EN.map.plate.ascending : EN.map.plate.descending

function pictureLine(radar: RadarMeta, drawn: RadarImage): string | null {
  const f = radar.frames[drawn.frame]
  if (f === undefined) return null
  return EN.map.plate.frame(
    radar.level,
    formatUtcDate(f.time),
    formatUtcTime(f.time),
    f.track,
    directionWord(f.direction),
  )
}

function groundLine(data: PlaceData): string | null {
  const ground = groundOverlay(data) === null ? null : (groundExample(data)?.ground ?? null)
  const first = ground?.pairs[0]
  const last = ground?.pairs.at(-1)
  if (ground == null || first === undefined || last === undefined) return null
  return EN.map.plate.ground(
    ground.product,
    ground.track,
    directionWord(ground.direction),
    formatUtcDate(first.from),
    formatUtcDate(last.to),
    ground.pixel_m,
  )
}

function sourceLine(radar: RadarMeta, drawn: RadarImage, notes: Notes) {
  const picture = pictureLine(radar, drawn)
  if (picture === null) return null
  const extra = [
    ...(drawn.falseColour ? [EN.map.plate.falseColour] : []),
    ...(notes.mask ? [EN.map.plate.frostMask] : []),
    ...(notes.partial ? [EN.map.plate.partial] : []),
    ...(notes.layer === null ? [] : [notes.layer]),
  ]
  const pixel =
    drawn.pixelM === radar.pixel_m
      ? EN.map.plate.pixel(radar.pixel_m)
      : EN.map.plate.pixelShown(radar.pixel_m, drawn.pixelM)
  return [`${picture}, ${pixel}`, ...extra].join('; ')
}

export function Provenance() {
  const place = useStore((s) => s.place)
  const globe = useStore((s) => s.panel === 'orbit')
  const mode = useStore((s) => s.mode)
  const tool = useStore((s) => s.tool)
  const frame = useStore((s) => s.frame)
  const story = useStore(selectStory)
  const selected = useStore((s) => s.selectedObject)
  const drawn = useDrawn((s) => s.radar)
  const mask = useDrawn((s) => s.mask)
  const partial = useDrawn((s) => s.partial)
  if (tool !== 'none') return null
  if (globe) return <Plate lines={[]} attribution={EN.map.plate.globe} />
  if (place.status !== 'ready') return null
  const { radar, objects } = place.data
  const business = mode === 'business'
  const time = radar?.frames[frame]?.time
  const ground = business && objects === null ? groundLine(place.data) : null
  const event =
    business && ground === null && drawn !== null
      ? eventPlate(place.data, story, selected, drawn.frame)
      : null
  const layer =
    business && objects !== null && time !== undefined
      ? heightsSource(objects, time)
      : (ground ?? event)
  const source =
    radar === null || drawn === null ? null : sourceLine(radar, drawn, { mask, partial, layer })
  const plate = EN.map.plate
  const attribution =
    business && objects !== null
      ? plate.business
      : ground !== null
        ? plate.businessGround
        : plate.place
  return <Plate lines={source === null ? [] : [source]} attribution={attribution} />
}
