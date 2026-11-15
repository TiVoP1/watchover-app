import { useShallow } from 'zustand/shallow'
import { useDrawn } from '#web/map/drawn.ts'
import { composeSentence } from '#web/sentence.ts'
import { selectZone, useStore } from '#web/state/store.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'

export function SentenceRow() {
  const state = useStore(
    useShallow((s) => ({
      place: s.place,
      panel: s.panel,
      frame: s.frame,
      playing: s.playing,
      paused: s.paused,
      chapter: s.chapter,
      gap: s.gap,
      item: s.item,
      mode: s.mode,
      tool: s.tool,
      notice: s.notice,
      nudge: s.nudge,
    })),
  )
  const zone = useStore(selectZone)
  const drawnFrame = useDrawn((s) => s.radar?.frame ?? null)
  const sentence = composeSentence(state, zone, drawnFrame)
  return (
    <div
      data-nudge={state.nudge ? 'on' : 'off'}
      className="col-span-2 flex h-12 items-center gap-4 border-b border-line bg-bg px-4"
    >
      {sentence?.when == null ? null : (
        <span className="shrink-0 tnum text-body text-text-2">{sentence.when}</span>
      )}
      {sentence?.kind == null ? null : <KindDisc kind={sentence.kind} />}
      <span className="truncate tnum text-sentence font-medium" aria-live="polite">
        {sentence?.text ?? ''}
      </span>
    </div>
  )
}
