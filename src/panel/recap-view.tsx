import { EN } from '#web/i18n/en.ts'
import { primaryKind } from '#web/panel/primary.ts'
import { useStore } from '#web/state/store.ts'
import type { Story } from '#web/story/chapters.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'
import { isTold, playable, toldTrust } from '#web/story/place-story.ts'
import { recapLines } from '#web/story/story-text.ts'
import { Icon } from '#web/ui/icon.tsx'

const SECONDARY =
  'flex items-center gap-2 rounded-sm border border-control px-3 py-1.5 text-body hover:bg-raised'

const cloudiestChapter = (story: Story) =>
  story.changes.find((c) => c.insetTile.variant === 'clouds') ??
  story.changes.find((c) => c.clouds !== null) ??
  null

export function RecapView() {
  const place = useStore((s) => s.place)
  const setPlaying = useStore((s) => s.setPlaying)
  const openItem = useStore((s) => s.openItem)
  const setTool = useStore((s) => s.setTool)
  const playsBright = useStore((s) => primaryKind(s) === 'play')
  if (place.status !== 'ready') return null
  const { data, story } = place
  const cloudy = cloudiestChapter(story)
  const lines = story.chapters.some(isTold)
    ? story.chapters.filter(isTold).map((c) => ({
        key: c.id,
        kind: c.kind,
        text: EN.told.recapLine(c.told.title, c.told.key, toldTrust(c)),
      }))
    : recapLines(story).map((line) => ({ key: line.kind, ...line }))
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center gap-3 tnum text-body text-text">
            <KindDisc kind={line.kind} />
            {line.text}
          </li>
        ))}
      </ul>
      <p className="text-sentence font-medium">{EN.recap.reports(story.changes.length)}</p>
      {story.clouds === null ? null : (
        <div className="flex flex-col items-start gap-3">
          <p className="tnum text-body text-text-2">
            {EN.recap.clouds(story.clouds.cloudyDays, story.clouds.passDays)}
          </p>
          {cloudy === null ? null : (
            <button
              type="button"
              onClick={() => {
                openItem(cloudy.id)
                setTool('clouds')
              }}
              className={SECONDARY}
            >
              <Icon name="cloud-slash" size={20} />
              {EN.card.throughClouds}
            </button>
          )}
        </div>
      )}
      {playsBright || !playable(data) ? null : (
        <div className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => {
              setPlaying(true)
            }}
            className={SECONDARY}
          >
            <Icon name="play" size={20} />
            {EN.recap.again}
          </button>
        </div>
      )}
    </div>
  )
}
