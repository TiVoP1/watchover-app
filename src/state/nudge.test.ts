import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { followNudge, IDLE_INPUTS, NUDGE_IDLE_MS, watchIdle } from '#web/state/nudge.ts'
import { useStore } from '#web/state/store.ts'

const initial = useStore.getState()
const state = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  useStore.setState(initial, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('watchIdle', () => {
  it('turns idle after the quiet time, and input before it restarts the wait', () => {
    const target = new EventTarget()
    const seen: boolean[] = []
    const stop = watchIdle(target, NUDGE_IDLE_MS, (idle) => seen.push(idle))
    vi.advanceTimersByTime(NUDGE_IDLE_MS - 1)
    target.dispatchEvent(new Event('pointermove'))
    vi.advanceTimersByTime(NUDGE_IDLE_MS - 1)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual([true])
    stop()
  })

  it.each(IDLE_INPUTS)('wakes once on %s and waits the full quiet time again', (type) => {
    const target = new EventTarget()
    const seen: boolean[] = []
    const stop = watchIdle(target, NUDGE_IDLE_MS, (idle) => seen.push(idle))
    vi.advanceTimersByTime(NUDGE_IDLE_MS)
    target.dispatchEvent(new Event(type))
    target.dispatchEvent(new Event(type))
    expect(seen).toEqual([true, false])
    vi.advanceTimersByTime(NUDGE_IDLE_MS)
    expect(seen).toEqual([true, false, true])
    stop()
  })

  it('leaves no timer and ignores input once stopped', () => {
    const target = new EventTarget()
    const seen: boolean[] = []
    const stop = watchIdle(target, NUDGE_IDLE_MS, (idle) => seen.push(idle))
    stop()
    expect(vi.getTimerCount()).toBe(0)
    target.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(NUDGE_IDLE_MS)
    expect(seen).toEqual([])
  })
})

describe('followNudge', () => {
  it('nudges only on the globe, never opens or selects anything, and drops it on input', () => {
    const target = new EventTarget()
    const stop = followNudge(target)
    vi.advanceTimersByTime(NUDGE_IDLE_MS)
    expect(state()).toMatchObject({ nudge: true, panel: 'orbit', item: null, place: initial.place })
    target.dispatchEvent(new Event('pointerdown'))
    expect(state().nudge).toBe(false)
    stop()
  })

  it('stops watching off the globe and starts again on return', () => {
    const target = new EventTarget()
    const stop = followNudge(target)
    vi.advanceTimersByTime(NUDGE_IDLE_MS)
    useStore.setState({ panel: 'rest' })
    expect(state().nudge).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    useStore.setState({ panel: 'orbit' })
    vi.advanceTimersByTime(NUDGE_IDLE_MS - 1)
    expect(state().nudge).toBe(false)
    vi.advanceTimersByTime(1)
    expect(state().nudge).toBe(true)
    stop()
    expect(state().nudge).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
