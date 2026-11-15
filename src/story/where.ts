import { bearingDeg, distanceKm } from '#web/film/geo.ts'

export type Compass =
  'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west'

export type LonLat = readonly [lon: number, lat: number]

export type Where =
  | { readonly kind: 'centre' }
  | { readonly kind: 'away'; readonly km: number; readonly toward: Compass }
  | { readonly kind: 'view'; readonly share: number }

export const CENTRE_RADIUS_KM = 1

const COMPASS: readonly Compass[] = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
]

const SECTOR_DEG = 360 / COMPASS.length

export function compass(bearing: number): Compass {
  const sector = Math.round((((bearing % 360) + 360) % 360) / SECTOR_DEG) % COMPASS.length
  return COMPASS[sector] ?? 'north'
}

export function whereFrom(centre: LonLat, point: LonLat): Where {
  const km = distanceKm(centre, point)
  if (km < CENTRE_RADIUS_KM) return { kind: 'centre' }
  return { kind: 'away', km: Math.round(km), toward: compass(bearingDeg(centre, point)) }
}

export type ViewPart = 'part' | 'half' | 'most' | 'all'

const VIEW_PARTS: readonly (readonly [minShare: number, part: ViewPart])[] = [
  [0.9, 'all'],
  [0.6, 'most'],
  [0.4, 'half'],
]

export const viewPart = (share: number): ViewPart =>
  VIEW_PARTS.find(([minShare]) => share >= minShare)?.[1] ?? 'part'
