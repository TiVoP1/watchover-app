import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/shallow'
import { BusinessView } from '#web/business/business-view.tsx'
import { EN } from '#web/i18n/en.ts'
import { OrbitPlaces } from '#web/panel/orbit-places.tsx'
import { primaryOf, runPrimary } from '#web/panel/primary.ts'
import { RecapView } from '#web/panel/recap-view.tsx'
import { RestView } from '#web/panel/rest-view.tsx'
import { selectItem, useStore } from '#web/state/store.ts'
import { isTold } from '#web/story/place-story.ts'
import { StoryCard } from '#web/story/story-card.tsx'
import { ToldCard } from '#web/story/told-card.tsx'
import { Icon } from '#web/ui/icon.tsx'
import { pulseRing } from '#web/ui/ring-pulse.ts'

const GLOW_SCALE_X = 1.05
const GLOW_SCALE_Y = 1.36

function NudgeGlow() {
  const ring = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (ring.current !== null) pulseRing(ring.current, GLOW_SCALE_X, GLOW_SCALE_Y)
  }, [])
  return (
    <span
      ref={ring}
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-sm border-2 border-text opacity-0 ease-reveal"
    />
  )
}

function PrimaryBar() {
  const primary = useStore(useShallow(primaryOf))
  const nudge = useStore((s) => s.nudge)
  const glow = nudge && primary.kind === 'open' && primary.enabled
  return (
    <div className="flex h-28 shrink-0 items-center border-t border-line px-4">
      <button
        type="button"
        data-primary={primary.kind}
        disabled={!primary.enabled}
        onClick={() => {
          runPrimary(primary.kind)
        }}
        className="relative flex h-11 flex-1 items-center justify-center gap-2 rounded-sm bg-text text-body font-medium text-ink disabled:opacity-50"
      >
        {glow ? <NudgeGlow /> : null}
        <Icon name={primary.icon} size={20} />
        {primary.label}
      </button>
    </div>
  )
}

function Body() {
  const panel = useStore((s) => s.panel)
  const mode = useStore((s) => s.mode)
  const item = useStore(selectItem)
  if (panel === 'orbit') return <OrbitPlaces />
  if (mode === 'business') return <BusinessView />
  if (panel === 'recap') return <RecapView />
  if (panel === 'story' && item !== null) {
    return isTold(item) ? (
      <ToldCard key={item.id} item={item} />
    ) : (
      <StoryCard key={item.id} item={item} />
    )
  }
  return <RestView />
}

export function Panel() {
  const scroller = useRef<HTMLDivElement>(null)
  const panel = useStore((s) => s.panel)
  const item = useStore((s) => s.item)
  const mode = useStore((s) => s.mode)
  const fog = useStore((s) => s.notice === 'fog')
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [panel, item, mode])
  return (
    <aside className="row-start-3 flex min-h-0 w-92 flex-col border-l border-line bg-panel">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {fog ? (
          <p className="border-b border-line px-4 py-3 text-body text-text-2">{EN.panel.fogMore}</p>
        ) : null}
        <Body />
      </div>
      <PrimaryBar />
    </aside>
  )
}
