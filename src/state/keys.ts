import { primaryOf, runPrimary } from '#web/panel/primary.ts'
import { useStore } from '#web/state/store.ts'

const TYPING = new Set(['INPUT', 'SELECT', 'TEXTAREA'])
const ACTIVATES = new Set(['BUTTON', 'A', 'SUMMARY'])

export interface KeyTarget {
  readonly tag: string
  readonly range: boolean
  readonly slider: boolean
}

export interface KeyPress {
  readonly key: string
  readonly repeat: boolean
  readonly modified: boolean
  readonly target: KeyTarget | null
}

export function pressKey({ key, repeat, modified, target }: KeyPress): boolean {
  if (modified) return false
  const tag = target?.tag ?? ''
  const typing = TYPING.has(tag)
  const s = useStore.getState()
  if (key === 'Escape' && (!typing || target?.range === true)) {
    s.back()
    return false
  }
  if (typing) return false
  if (key === 'Enter' || key === ' ') {
    if (ACTIVATES.has(tag) || repeat) return false
    if (key === 'Enter' && s.panel !== 'orbit') return false
    const primary = primaryOf(s)
    if (primary.enabled) runPrimary(primary.kind)
    return true
  }
  if (s.panel === 'orbit' || target?.slider === true) return false
  if (key === 'ArrowRight') s.setFrame(s.frame + 1)
  if (key === 'ArrowLeft') s.setFrame(s.frame - 1)
  return false
}
