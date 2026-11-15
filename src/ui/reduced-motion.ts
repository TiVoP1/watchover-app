import { useSyncExternalStore } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export const prefersReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION).matches

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

export const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, prefersReducedMotion)
