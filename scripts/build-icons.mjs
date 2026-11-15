import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const assets = `${root}node_modules/@phosphor-icons/core/assets`

const REGULAR = [
  'house-line',
  'map-pin-area',
  'plus',
  'stack-simple',
  'cloud-slash',
  'stack',
  'split-horizontal',
  'film-strip',
  'calendar-star',
  'play',
  'pause',
  'speaker-high',
  'speaker-slash',
  'export',
  'briefcase',
  'table',
  'brackets-curly',
  'warning',
  'caret-left',
  'caret-right',
  'x',
  'clock',
  'info',
]
const BOLD = ['waves', 'drop-half-bottom', 'grains', 'tree-evergreen', 'buildings', 'snowflake']

const paths = (svg) => [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
const entries = [
  ...REGULAR.map((name) => [name, paths(readFileSync(`${assets}/regular/${name}.svg`, 'utf8'))]),
  ...BOLD.map((name) => [
    `${name}-bold`,
    paths(readFileSync(`${assets}/bold/${name}-bold.svg`, 'utf8')),
  ]),
]

const body = entries.map(([name, d]) => `  '${name}': ${JSON.stringify(d)},`).join('\n')
writeFileSync(
  `${root}src/ui/icon-paths.ts`,
  `/** Output of scripts/build-icons.mjs: add icons to its REGULAR or BOLD list, hand edits here are overwritten. */\nexport const PHOSPHOR = {\n${body}\n} as const\n\nexport type PhosphorName = keyof typeof PHOSPHOR\n`,
)
