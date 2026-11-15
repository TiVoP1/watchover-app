import type { LonLat } from '#web/story/where.ts'

export type LabelSide = 'left' | 'right'

export const PLACE_FILES = [
  'clouds.json',
  'weather.json',
  'events.json',
  'insar/insar.json',
  'insar/objects.json',
  'insar/objects.geojson',
  'insar/null_check.json',
  'radar-play.json',
  'story.json',
  'ground.json',
  'event.json',
] as const

export type PlaceFile = (typeof PLACE_FILES)[number]

export interface PlaceEntry {
  readonly slug: string
  readonly label: string
  readonly name: string
  readonly timeZone: string
  readonly centre: LonLat
  readonly labelSide: LabelSide
  readonly files: readonly PlaceFile[]
  readonly sharpenTarget?: LonLat
}

const EVENT_FILES: readonly PlaceFile[] = ['story.json', 'event.json']

export const PLACES: readonly [PlaceEntry, ...PlaceEntry[]] = [
  {
    slug: 'stalowa-wola',
    label: 'Stalowa Wola',
    name: 'Stalowa Wola, Poland',
    timeZone: 'Europe/Warsaw',
    centre: [22.05, 50.58],
    labelSide: 'right',
    files: [
      'clouds.json',
      'weather.json',
      'events.json',
      'insar/insar.json',
      'insar/objects.json',
      'insar/objects.geojson',
      'insar/null_check.json',
      'radar-play.json',
    ],
    sharpenTarget: [22.055, 50.552],
  },
  {
    slug: 'mexico-city',
    label: 'Mexico City',
    name: 'Mexico City, Mexico',
    timeZone: 'America/Mexico_City',
    centre: [-99.07, 19.43],
    labelSide: 'right',
    files: ['story.json', 'ground.json'],
  },
  {
    slug: 'world-hayli-gubbi',
    label: 'Hayli Gubbi',
    name: 'Hayli Gubbi, Ethiopia',
    timeZone: 'Africa/Addis_Ababa',
    centre: [40.695, 13.555],
    labelSide: 'left',
    files: EVENT_FILES,
  },
  {
    slug: 'world-venezuela-quake',
    label: 'La Guaira',
    name: 'La Guaira, Venezuela',
    timeZone: 'America/Caracas',
    centre: [-67.06, 10.56],
    labelSide: 'right',
    files: EVENT_FILES,
  },
  {
    slug: 'world-mozambique-flood',
    label: 'Chokwe',
    name: 'Chokwe, Mozambique',
    timeZone: 'Africa/Maputo',
    centre: [33, -24.55],
    labelSide: 'right',
    files: EVENT_FILES,
  },
]

export const placeBySlug = (slug: string): PlaceEntry =>
  PLACES.find((p) => p.slug === slug) ?? PLACES[0]

export const STORY_PLACE: PlaceEntry = PLACES[0]

export const placeName = (p: PlaceEntry): string =>
  p.name.startsWith(p.label) ? p.name : `${p.label}, ${p.name}`
