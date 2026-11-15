import { PHOSPHOR, type PhosphorName } from '#web/ui/icon-paths.ts'

const CUSTOM = {
  nisar: [
    'M128,72c-43.1,0-78.3,28.6-92,56,13.7,27.4,48.9,56,92,56s78.3-28.6,92-56C206.3,100.6,171.1,72,128,72Z',
    'M128,100a28,28,0,1,1-28,28A28,28,0,0,1,128,100Z',
  ],
  ground: ['M32,104H224', 'M32,152H224', 'M128,168v56', 'M104,200l24,24,24-24'],
  volcano: ['M32,216L100,104h56l68,112Z', 'M128,72V32'],
  quake: ['M24,128H72L96,72l48,112,24-56h64'],
} as const

type CustomName = keyof typeof CUSTOM
export type IconName = PhosphorName | CustomName

interface Props {
  readonly name: IconName
  readonly size?: number
  readonly className?: string
  readonly label?: string
}

export function Icon({ name, size = 20, className, label }: Props) {
  const a11y = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }
  if (name in CUSTOM) {
    const paths = CUSTOM[name as CustomName]
    return (
      <svg
        viewBox="0 0 256 256"
        width={size}
        height={size}
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={name === 'nisar' ? 16 : 24}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...a11y}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
        {name === 'nisar' ? (
          <circle cx="128" cy="128" r="9" fill="currentColor" stroke="none" />
        ) : null}
      </svg>
    )
  }
  const paths = PHOSPHOR[name as PhosphorName]
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      {...a11y}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
