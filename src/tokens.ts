export const COLOR = {
  bg: '#13161a',
  panel: '#1a1d22',
  raised: '#23272d',
  line: '#31363d',
  control: '#6e7580',
  text: '#eceef1',
  text2: '#b6bcc4',
  text3: '#9097a1',
  accent: '#eafe07',
  accentInk: '#07173f',
  ink: '#0b0d10',
  error: '#ff7a5c',
  mapLand: '#1b1e22',
  mapWater: '#0f1215',
  mapRoad: '#2e3238',
  mapLabel: '#a3aab3',
  radarLo: '#0b0d10',
  evWater: '#7bbafd',
  evFields: '#f1aa26',
  evForest: '#79cd9b',
  evBuilt: '#d76f50',
  evGround: '#9673da',
  evSnow: '#e2e9f0',
} as const

/** Index 0 is away from the satellite (red), the last towards it (blue); published berlin runs the other way. */
export const LOS_RAMP = [
  '#ffadad',
  '#be6f63',
  '#7d341e',
  '#411201',
  '#190c09',
  '#14303e',
  '#286886',
  '#519fd3',
  '#9eb0ff',
] as const

export const MOTION = {
  frameMs: 160,
  uiMs: 220,
  passMs: 900,
  flyMs: 1400,
  quietPassMs: 150,
  changePassMs: 3000,
  gapHoldMs: 1200,
  flipMs: 750,
  sharpenStepMs: 500,
} as const

export const TEXT_PX = {
  meta: 13,
  body: 14,
  card: 16,
  sentence: 18,
  figure: 28,
} as const
