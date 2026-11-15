import { type StoreState, useStore } from '#web/state/store.ts'

export const NUDGE_IDLE_MS = 8_000

export const IDLE_INPUTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const

export function watchIdle(
  target: EventTarget,
  idleMs: number,
  onChange: (idle: boolean) => void,
): () => void {
  let idle = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      idle = true
      onChange(true)
    }, idleMs)
  }
  const wake = () => {
    arm()
    if (!idle) return
    idle = false
    onChange(false)
  }
  for (const type of IDLE_INPUTS) {
    target.addEventListener(type, wake, { capture: true, passive: true })
  }
  arm()
  return () => {
    clearTimeout(timer)
    for (const type of IDLE_INPUTS) target.removeEventListener(type, wake, { capture: true })
  }
}

export function followNudge(target: EventTarget): () => void {
  let stop: (() => void) | null = null
  const halt = () => {
    stop?.()
    stop = null
    useStore.getState().setNudge(false)
  }
  const sync = (s: StoreState) => {
    const globe = s.panel === 'orbit'
    if (globe === (stop !== null)) return
    if (globe) stop = watchIdle(target, NUDGE_IDLE_MS, s.setNudge)
    else halt()
  }
  sync(useStore.getState())
  const unsubscribe = useStore.subscribe(sync)
  return () => {
    unsubscribe()
    halt()
  }
}
