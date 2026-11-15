import type { Vec3 } from '#web/film/geo.ts'

interface HookConfig {
  readonly slug: string
  readonly osmWay: number
  readonly duskTrack: number
  readonly duskGroundToSatEnu: Vec3
  readonly motionExaggeration: number
}

export const HOOK: HookConfig = {
  slug: 'stalowa-wola',
  osmWay: 359317018,
  duskTrack: 123,
  duskGroundToSatEnu: [-0.5605, 0.2168, 0.7993],
  motionExaggeration: 20000,
}

export const NISAR_ALTITUDE_KM = 747

export const PLACES = [
  { slug: 'mexico-city', name: 'Mexico City' },
  { slug: 'rondonia', name: 'Rondônia' },
  { slug: 'bengal', name: 'West Bengal' },
] as const
