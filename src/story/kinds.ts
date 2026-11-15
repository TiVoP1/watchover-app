import { COLOR } from '#web/tokens.ts'
import type { IconName } from '#web/ui/icon.tsx'

export type ToldKind = 'ground' | 'volcano' | 'quake' | 'flood' | 'other'

export type ChangeKind = 'frost' | 'forest' | 'fields' | 'water' | 'rework' | 'heat' | ToldKind

export interface KindStyle {
  readonly icon: IconName
  readonly colour: string
  readonly disc: string
  readonly glyph: string
  readonly fill: string
  readonly stroke: string
}

export const KIND_STYLE: Readonly<Record<ChangeKind, KindStyle>> = {
  frost: {
    icon: 'snowflake-bold',
    colour: COLOR.evSnow,
    disc: 'bg-ev-snow text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-snow',
    stroke: 'stroke-ev-snow',
  },
  forest: {
    icon: 'tree-evergreen-bold',
    colour: COLOR.evForest,
    disc: 'bg-ev-forest text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-forest',
    stroke: 'stroke-ev-forest',
  },
  fields: {
    icon: 'grains-bold',
    colour: COLOR.evFields,
    disc: 'bg-ev-fields text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-fields',
    stroke: 'stroke-ev-fields',
  },
  water: {
    icon: 'waves-bold',
    colour: COLOR.evWater,
    disc: 'bg-ev-water text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-water',
    stroke: 'stroke-ev-water',
  },
  rework: {
    icon: 'buildings-bold',
    colour: COLOR.evBuilt,
    disc: 'bg-ev-built text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-built',
    stroke: 'stroke-ev-built',
  },
  heat: {
    icon: 'ground',
    colour: COLOR.text2,
    disc: 'bg-raised text-text-2',
    glyph: 'text-text-2',
    fill: 'fill-raised',
    stroke: 'stroke-text-2',
  },
  ground: {
    icon: 'ground',
    colour: COLOR.evGround,
    disc: 'bg-ev-ground text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-ground',
    stroke: 'stroke-ev-ground',
  },
  volcano: {
    icon: 'volcano',
    colour: COLOR.evGround,
    disc: 'bg-ev-ground text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-ground',
    stroke: 'stroke-ev-ground',
  },
  quake: {
    icon: 'quake',
    colour: COLOR.evGround,
    disc: 'bg-ev-ground text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-ground',
    stroke: 'stroke-ev-ground',
  },
  flood: {
    icon: 'waves-bold',
    colour: COLOR.evWater,
    disc: 'bg-ev-water text-ink',
    glyph: 'text-ink',
    fill: 'fill-ev-water',
    stroke: 'stroke-ev-water',
  },
  other: {
    icon: 'nisar',
    colour: COLOR.text2,
    disc: 'bg-raised text-text-2',
    glyph: 'text-text-2',
    fill: 'fill-raised',
    stroke: 'stroke-text-2',
  },
}
