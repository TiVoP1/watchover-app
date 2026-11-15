import { useEffect } from 'react'
import { EN } from '#web/i18n/en.ts'
import { Provenance } from '#web/map/map-chrome.tsx'
import { MapView } from '#web/map/map-view.tsx'
import { Panel } from '#web/panel/panel.tsx'
import { SentenceRow } from '#web/sentence-row.tsx'
import { type KeyTarget, pressKey } from '#web/state/keys.ts'
import { followNudge } from '#web/state/nudge.ts'
import { useStore } from '#web/state/store.ts'
import { useUrlState } from '#web/state/url.ts'
import { ChangeInset } from '#web/story/change-inset.tsx'
import { Timeline } from '#web/timeline/timeline.tsx'
import { ToolsOverlay } from '#web/tools/tools-overlay.tsx'
import { TopBar } from '#web/top-bar.tsx'

const keyTarget = (target: EventTarget | null): KeyTarget | null =>
  target instanceof HTMLElement
    ? {
        tag: target.tagName,
        range: target instanceof HTMLInputElement && target.type === 'range',
        slider: target.getAttribute('role') === 'slider',
      }
    : null

function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented) return
  const modified = e.altKey || e.ctrlKey || e.metaKey
  const press = { key: e.key, repeat: e.repeat, modified, target: keyTarget(e.target) }
  if (pressKey(press)) e.preventDefault()
}

function useKeyboard() {
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

function Status() {
  const place = useStore((s) => s.place)
  const open = useStore((s) => s.open)
  if (place.status === 'loading') {
    return <div className="absolute inset-x-0 top-0 h-0.5 bg-text-3" aria-label={EN.loading} />
  }
  if (place.status === 'error') {
    return (
      <div className="absolute top-1/3 left-1/2 w-105 -translate-x-1/2 rounded-md border border-line bg-panel p-4">
        <p className="text-body text-text">{EN.loadError}</p>
        <button
          type="button"
          onClick={() => {
            void open(place.slug)
          }}
          className="mt-3 rounded-sm border border-control px-3 py-1.5 text-body hover:bg-raised"
        >
          {EN.retry}
        </button>
      </div>
    )
  }
  return null
}

export function App() {
  useKeyboard()
  useUrlState()
  useEffect(() => followNudge(window), [])
  return (
    <div className="grid h-full grid-cols-[1fr_auto] grid-rows-[auto_auto_1fr]">
      <TopBar />
      <SentenceRow />
      <div className="row-start-3 flex min-h-0 min-w-0 flex-col">
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <MapView />
          <Provenance />
          <ChangeInset />
          <ToolsOverlay />
          <Status />
        </main>
        <Timeline />
      </div>
      <Panel />
    </div>
  )
}
