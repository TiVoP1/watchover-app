import { type Ref, useEffect, useMemo, useRef, useState } from 'react'
import {
  colourKey,
  objectLabel,
  populationLine,
  populationMeta,
  rowHeadline,
  statusText,
  watchSentence,
} from '#web/business/copy.ts'
import {
  COLOUR_SCALE_MM_PER_C,
  districtTint,
  exaggerationNote,
  heightsLine,
  heightsState,
} from '#web/business/district.ts'
import { eventItems } from '#web/business/event.ts'
import { EventView } from '#web/business/event-view.tsx'
import { groundExample } from '#web/business/ground.ts'
import { GroundView } from '#web/business/ground-view.tsx'
import { HeatChart } from '#web/business/heat-chart.tsx'
import {
  type BusinessRow,
  businessRows,
  earlyResult,
  eveningPopulation,
  type Population,
  selectErrorScale,
} from '#web/business/motion.ts'
import type { Objects, PlaceData } from '#web/data/types.ts'
import { EN } from '#web/i18n/en.ts'
import { selectStory, selectZone, useStore } from '#web/state/store.ts'
import { buildingBecause, heatMeta } from '#web/story/story-text.ts'
import type { LonLat } from '#web/story/where.ts'
import { COLOR } from '#web/tokens.ts'
import { formatNumber, formatUtcDate, formatUtcTime } from '#web/ui/format.ts'

const VISIBLE_ROWS = 10

function Swatch({ colour }: { readonly colour: string }) {
  return <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colour }} />
}

interface DistrictKeyProps {
  readonly rows: readonly BusinessRow[]
  readonly population: Population | null
  readonly months: number | null
  readonly note: string
}

function DistrictKey({ rows, population, months, note }: DistrictKeyProps) {
  const clear = rows.find((r) => r.label === 'beats_all' && r.object.kind === 'building')
  const clearK = clear?.heat.evening?.mmPerC ?? COLOUR_SCALE_MM_PER_C
  const colour = colourKey(rows)
  const meta = population === null ? null : populationMeta(population, months)
  return (
    <div className="px-4 pb-3">
      {population === null ? null : (
        <p className="text-body text-text">{populationLine(population)}</p>
      )}
      {meta === null ? null : <p className="mt-1 text-meta text-text-3">{meta}</p>}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-text-2">
        {clear === undefined ? null : (
          <li className="flex items-center gap-1.5">
            <Swatch colour={districtTint(clearK, 'beats_all')} />
            {EN.business.keyClear}
          </li>
        )}
        {rows.some((r) => r.pin === 'watch') ? (
          <li className="flex items-center gap-1.5">
            <Swatch colour={COLOR.text2} />
            {EN.business.watchTag}
          </li>
        ) : null}
        <li className="flex items-center gap-1.5">
          <Swatch colour={COLOR.control} />
          {EN.business.status.noise}
        </li>
      </ul>
      <p className="mt-1 text-meta text-text-3">{colour === null ? note : `${colour} ${note}`}</p>
    </div>
  )
}

function Source({
  row,
  objects,
  data,
}: {
  readonly row: BusinessRow
  readonly objects: Objects
  readonly data: PlaceData
}) {
  const evening = row.heat.evening
  if (evening === null) return null
  const first = evening.passes[0]
  const last = evening.passes.at(-1)
  if (first === undefined || last === undefined) return null
  const direction = evening.direction === 'ASCENDING' ? EN.ascending : EN.descending
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-meta text-text-2">
        {EN.business.source(evening.passes.length)}
      </summary>
      <div className="mt-1 space-y-1 text-meta text-text-3">
        <p className="tnum">
          {EN.business.sourcePasses(
            objects.level,
            evening.track,
            direction,
            formatUtcDate(first.time),
            formatUtcDate(last.time),
            formatUtcTime(first.time),
          )}
        </p>
        <ul className="break-all">
          {evening.passes.map((pass) => (
            <li key={pass.time}>{pass.scene}</li>
          ))}
        </ul>
        <p>{EN.business.sourceFootprint(row.object.osm)}</p>
        {data.nullCheck === null ? null : (
          <p>{EN.business.sourceCheck(formatNumber(data.nullCheck.squares_coherent_both))}</p>
        )}
      </div>
    </details>
  )
}

interface DetailProps {
  readonly row: BusinessRow
  readonly objects: Objects
  readonly data: PlaceData
  readonly timeZone: string
  readonly errorScale: number
  readonly at: string | null
}

function Detail({ row, objects, data, timeZone, errorScale, at }: DetailProps) {
  const { heat } = row
  const because = row.pin === 'story' && row.range !== null ? buildingBecause(row.range) : null
  const watch = row.pin === 'watch' ? watchSentence(heat, errorScale) : null
  const meta = heatMeta(heat, errorScale, row.pin !== 'watch')
  return (
    <div className="px-4 pt-1 pb-4">
      {because === null ? null : (
        <>
          <p className="text-meta text-text-3">{EN.card.because}</p>
          <p className="text-body text-text">{because}</p>
        </>
      )}
      {watch === null ? null : <p className="text-body text-text">{watch}</p>}
      {heat.evening === null ? (
        <p className="text-meta text-text-3">{EN.business.noEvening}</p>
      ) : (
        <div className="mt-3">
          <HeatChart heat={heat} timeZone={timeZone} at={at} />
        </div>
      )}
      {meta === null ? null : <p className="mt-2 text-meta text-text-3">{meta}</p>}
      <Source row={row} objects={objects} data={data} />
    </div>
  )
}

interface RowProps extends Omit<DetailProps, 'row'> {
  readonly row: BusinessRow
  readonly centre: LonLat
  readonly selected: boolean
  readonly onSelect: () => void
  readonly rowRef: Ref<HTMLButtonElement> | undefined
}

function Row({ row, centre, selected, onSelect, rowRef, ...detail }: RowProps) {
  const { object } = row
  const headline = rowHeadline(object, row.label, row.range)
  return (
    <li className="border-b border-line">
      <button
        ref={rowRef}
        type="button"
        aria-expanded={selected}
        onClick={onSelect}
        className={`block w-full px-4 py-2.5 text-left hover:bg-raised ${selected ? 'bg-raised' : ''}`}
      >
        <span className="flex items-start justify-between gap-2">
          <span
            className={`min-w-0 text-body font-medium ${object.name === null ? '' : 'truncate'}`}
          >
            {object.name ?? objectLabel(object, centre)}
          </span>
          {row.pin === 'watch' ? (
            <span className="shrink-0 rounded-sm border border-control px-1.5 text-meta text-text-2">
              {EN.business.watchTag}
            </span>
          ) : null}
        </span>
        {headline === null ? null : (
          <span className="block tnum text-body text-text-2">{headline}</span>
        )}
        {row.label === null ? null : (
          <span className="block text-meta text-text-3">{statusText(row.label)}</span>
        )}
      </button>
      {selected ? <Detail row={row} {...detail} /> : null}
    </li>
  )
}

function BuildingsView({ data, objects }: { readonly data: PlaceData; readonly objects: Objects }) {
  const story = useStore(selectStory)
  const selected = useStore((s) => s.selectedObject)
  const select = useStore((s) => s.select)
  const frame = useStore((s) => s.frame)
  const inPlay = useStore((s) => s.playing || s.paused)
  const timeZone = useStore(selectZone)
  const errorScale = useStore(selectErrorScale)
  const [all, setAll] = useState(false)
  const selectedRow = useRef<HTMLButtonElement>(null)
  const rows = useMemo(() => businessRows(data, story), [data, story])
  const population = useMemo(
    () => eveningPopulation(objects, data.nullCheck),
    [objects, data.nullCheck],
  )
  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  const time = data.radar?.frames[frame]?.time
  const state = time === undefined ? null : heightsState(objects, time)
  const at = inPlay && state !== null && state.kind !== 'before' ? state.pass.time : null
  const shown = all ? rows : rows.slice(0, VISIBLE_ROWS)
  const extra =
    selected === null || shown.some((r) => r.object.osm === selected)
      ? []
      : rows.filter((r) => r.object.osm === selected)
  const hidden = rows.length - shown.length
  const early = earlyResult(data)
  const centre: LonLat = [data.catalog.place.lon, data.catalog.place.lat]
  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-card font-semibold">{EN.business.question}</h2>
        {early === null ? null : (
          <p className="mt-1 text-meta text-text-3">
            {EN.business.early(early.passes, early.months)}
          </p>
        )}
      </div>
      <DistrictKey
        rows={rows}
        population={population}
        months={early?.months ?? null}
        note={state === null ? exaggerationNote() : heightsLine(state, timeZone)}
      />
      <ul className="border-t border-line">
        {[...shown, ...extra].map((row) => (
          <Row
            key={row.object.osm}
            row={row}
            objects={objects}
            data={data}
            centre={centre}
            timeZone={timeZone}
            errorScale={errorScale}
            at={at}
            selected={selected === row.object.osm}
            rowRef={selected === row.object.osm ? selectedRow : undefined}
            onSelect={() => {
              select(selected === row.object.osm ? null : row.object.osm)
            }}
          />
        ))}
      </ul>
      {hidden > 0 || all ? (
        <button
          type="button"
          onClick={() => {
            setAll(!all)
          }}
          className="px-4 py-2 text-meta text-text-2 hover:text-text"
        >
          {all ? EN.business.fewer : EN.business.more(hidden)}
        </button>
      ) : null}
    </>
  )
}

export function BusinessView() {
  const place = useStore((s) => s.place)
  const story = useStore(selectStory)
  const timeZone = useStore(selectZone)
  const data = place.status === 'ready' ? place.data : null
  const example = useMemo(() => (data === null ? null : groundExample(data)), [data])
  const events = useMemo(() => eventItems(story), [story])
  if (data === null) return null
  if (data.objects !== null) return <BuildingsView data={data} objects={data.objects} />
  if (example !== null) return <GroundView example={example} timeZone={timeZone} />
  if (events.length > 0) return <EventView items={events} />
  return (
    <div className="px-4 pt-4">
      <h2 className="text-card font-semibold">{EN.business.question}</h2>
      <p className="mt-2 text-body text-text-2">{EN.business.empty}</p>
    </div>
  )
}
