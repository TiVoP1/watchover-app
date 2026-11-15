import { EN } from '#web/i18n/en.ts'
import { Disclosure } from '#web/panel/disclosure.tsx'
import { selectZone, useStore } from '#web/state/store.ts'
import type { WeatherSetAside } from '#web/story/chapters.ts'
import { directionWord, monthSpanText } from '#web/story/story-text.ts'
import { sharpenStack } from '#web/tools/sharpen.ts'
import { formatNumber, formatUtcDate, formatUtcTime } from '#web/ui/format.ts'
import { Icon } from '#web/ui/icon.tsx'

function WeatherLine({ weather }: { readonly weather: WeatherSetAside }) {
  const zone = useStore(selectZone)
  const { from, to } = monthSpanText(weather.from, weather.to, zone)
  return (
    <p className="mt-3 tnum text-meta text-text-3">
      {EN.rest.weather(formatNumber(weather.setAside), formatNumber(weather.total), from, to)}
    </p>
  )
}

export function MoreSection() {
  const place = useStore((s) => s.place)
  const falseColour = useStore((s) => s.falseColour)
  const setFalseColour = useStore((s) => s.setFalseColour)
  const setTool = useStore((s) => s.setTool)
  if (place.status !== 'ready' || place.data.radar === null) return null
  const radar = place.data.radar
  const newestFirst = [...radar.frames].reverse()
  const sharpen = sharpenStack(radar) !== null
  const { image, sharpen: sharpenPart, sources } = EN.rest.moreParts
  const parts = (sharpen ? [image, sharpenPart, sources] : [image, sources]).join(', ')
  return (
    <Disclosure summary={EN.rest.more(parts, radar.frames.length)}>
      <p className="text-meta text-text-3">{EN.rest.image}</p>
      <label className="mt-2 flex cursor-pointer items-center gap-3 text-body">
        <input
          type="checkbox"
          checked={falseColour}
          onChange={(e) => {
            setFalseColour(e.target.checked)
          }}
          className="size-4 accent-text"
        />
        {EN.rest.falseColour}
      </label>
      {falseColour ? (
        <p className="mt-2 text-meta text-text-3">{EN.rest.falseColourLegend}</p>
      ) : null}
      {sharpen ? (
        <button
          type="button"
          onClick={() => {
            setTool('sharpen')
          }}
          className="mt-3 flex items-center gap-2 rounded-sm border border-control px-3 py-1.5 text-body hover:bg-raised"
        >
          <Icon name="stack" size={20} />
          {EN.rest.sharpen}
        </button>
      ) : null}
      <p className="mt-4 text-meta text-text-3">{EN.rest.sources}</p>
      <ul className="mt-1 max-h-64 overflow-y-auto">
        {newestFirst.map((f) => (
          <li key={f.scene} className="tnum text-meta text-text-3">
            {EN.card.sourceLine(
              radar.level,
              formatUtcDate(f.time),
              formatUtcTime(f.time),
              f.track,
              directionWord(f.direction),
            )}
          </li>
        ))}
      </ul>
      {place.story.weather === null ? null : <WeatherLine weather={place.story.weather} />}
    </Disclosure>
  )
}
