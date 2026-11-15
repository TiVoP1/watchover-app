import { NISAR_REPEAT_DAYS, PUBLICATION_DELAY_MAX_DAYS } from '#web/data/nisar.ts'
import { EN } from '#web/i18n/en.ts'
import { openPlace } from '#web/panel/primary.ts'
import { PLACES, placeName } from '#web/places.ts'
import { useMinuteClock } from '#web/state/clock.ts'
import { type Mode, placeSlug, selectZone, useStore } from '#web/state/store.ts'
import { BrandMark } from '#web/ui/brand-mark.tsx'
import { Icon, type IconName } from '#web/ui/icon.tsx'
import { addDays, formatLocalTime, formatShortDate, formatWeekdayDate } from '#web/ui/format.ts'

function NextLook() {
  const place = useStore((s) => s.place)
  const globe = useStore((s) => s.panel === 'orbit')
  const zone = useStore(selectZone)
  const now = useMinuteClock()
  if (place.status !== 'ready' || globe) return null
  const next = place.data.catalog.schedule.upcoming.find((p) => Date.parse(p.time) > now)
  if (next === undefined) return null
  const picture = addDays(next.time, PUBLICATION_DELAY_MAX_DAYS)
  const hint = next.projected ? EN.nextLook.hint(NISAR_REPEAT_DAYS) : EN.nextLook.hintScheduled
  const day = formatWeekdayDate(next.time, zone)
  const time = formatLocalTime(next.time, zone)
  return (
    <p className="flex items-baseline gap-2 text-body text-text-2" title={hint}>
      <span>{EN.nextLook.label}</span>
      <span className="tnum text-card font-semibold text-accent">
        {next.projected ? EN.nextLook.whenEstimated(day, time) : EN.nextLook.when(day, time)}
      </span>
      <span className="tnum text-meta text-text-3">
        {EN.nextLook.picture(formatShortDate(picture, zone))}
      </span>
    </p>
  )
}

function PlaceSwitch() {
  const current = useStore((s) => placeSlug(s.place) ?? '')
  const globe = useStore((s) => s.panel === 'orbit')
  return (
    <select
      className="cursor-pointer rounded-sm border border-line bg-panel py-1 pr-2 pl-2 text-card font-semibold text-text"
      value={globe ? '' : current}
      onChange={(e) => {
        void openPlace(e.target.value)
      }}
      aria-label={EN.myPlaces}
    >
      {globe ? (
        <option value="" disabled>
          {EN.globe.choose}
        </option>
      ) : null}
      {PLACES.map((p) => (
        <option key={p.slug} value={p.slug}>
          {placeName(p)}
        </option>
      ))}
    </select>
  )
}

const MODES: readonly { readonly id: Mode; readonly label: string; readonly icon: IconName }[] = [
  { id: 'people', label: EN.modePeople, icon: 'house-line' },
  { id: 'business', label: EN.modeBusiness, icon: 'briefcase' },
]

function ModeTabs() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  return (
    <div className="flex h-full items-stretch gap-6" role="tablist" aria-label={EN.modes}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => {
            setMode(m.id)
          }}
          className={`flex items-center gap-2 border-b-2 px-1 text-body ${mode === m.id ? 'border-text font-medium text-text' : 'border-transparent text-text-2 hover:text-text'}`}
        >
          <Icon name={m.icon} size={20} />
          {m.label}
        </button>
      ))}
    </div>
  )
}

export function TopBar() {
  return (
    <header className="col-span-2 flex h-13 items-center gap-8 border-b border-line bg-panel px-4">
      <div className="flex items-center gap-2">
        <BrandMark size={24} className="text-accent" />
        <span className="text-card font-semibold">{EN.brand}</span>
      </div>
      <PlaceSwitch />
      <div className="flex-1" />
      <NextLook />
      <ModeTabs />
    </header>
  )
}
