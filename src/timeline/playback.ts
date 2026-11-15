import { type Mode, type PlayStep, useStore } from '#web/state/store.ts'
import { chapterAt, playStartFrame, type Story } from '#web/story/chapters.ts'
import { MOTION } from '#web/tokens.ts'

export interface TimedStep extends PlayStep {
  readonly holdMs: number
}

export function playSchedule(
  story: Story,
  frameCount: number,
  mode: Mode,
  start: number,
): readonly TimedStep[] {
  const people = mode === 'people'
  const steps: TimedStep[] = []
  let shown: number | null = null
  for (let frame = Math.max(0, start); frame < frameCount; frame++) {
    const stop = people ? chapterAt(story, frame) : null
    if (stop !== null) shown = stop.n
    const holdMs = stop === null ? MOTION.quietPassMs : MOTION.changePassMs
    steps.push({ frame, chapter: shown, gap: false, holdMs })
    if (people && story.gap?.lastBefore === frame) {
      steps.push({ frame, chapter: null, gap: true, holdMs: MOTION.gapHoldMs })
      shown = null
    }
  }
  return steps
}

export function stepIndex(steps: readonly TimedStep[], frame: number, gap: boolean): number {
  const exact = steps.findIndex((s) => s.frame === frame && s.gap === gap)
  if (exact !== -1) return exact
  const next = steps.findIndex((s) => s.frame >= frame)
  return next === -1 ? 0 : next
}

export function runSteps(
  steps: readonly TimedStep[],
  from: number,
  onStep: (step: TimedStep) => void,
  onEnd: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const show = (index: number) => {
    const step = steps[index]
    if (step === undefined) {
      onEnd()
      return
    }
    onStep(step)
    timer = setTimeout(() => {
      show(index + 1)
    }, step.holdMs)
  }
  show(from)
  return () => {
    clearTimeout(timer)
  }
}

export function startPlayback(): () => void {
  const s = useStore.getState()
  if (!s.playing || s.place.status !== 'ready') return () => undefined
  const { data, story } = s.place
  const steps = playSchedule(
    story,
    data.radar?.frames.length ?? 0,
    s.mode,
    playStartFrame(data, s.mode),
  )
  return runSteps(
    steps,
    stepIndex(steps, s.frame, s.gap),
    (step) => {
      useStore.getState().playAt(step)
    },
    () => {
      useStore.getState().finishPlay()
    },
  )
}

export function followPlayback(): () => void {
  let stop = startPlayback()
  const unsubscribe = useStore.subscribe((s, previous) => {
    if (s.playing === previous.playing) return
    stop()
    stop = startPlayback()
  })
  return () => {
    unsubscribe()
    stop()
  }
}
