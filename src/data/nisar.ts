import type { Direction } from '#web/data/types.ts'

export const NISAR_REPEAT_DAYS = 12

export const PUBLICATION_DELAY_MAX_DAYS = 14

export const EVENING_ORBIT: Direction = 'DESCENDING'

export type OrbitPart = 'dawn' | 'evening'

export const orbitPart = (direction: Direction): OrbitPart =>
  direction === EVENING_ORBIT ? 'evening' : 'dawn'
