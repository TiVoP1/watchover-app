import { useId } from 'react'

export function BrandMark({
  size,
  className,
}: {
  readonly size: number
  readonly className?: string
}) {
  const mask = useId()
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={mask}>
          <rect width="64" height="64" fill="white" />
          <path
            d="M5 32A27 8.5 0 0 0 59 32"
            transform="rotate(-18 32 32)"
            stroke="black"
            strokeWidth="11"
          />
        </mask>
      </defs>
      <path
        d="M18.64 31.82A15 15 0 1 1 45.36 31.82L34.67 52.76A3 3 0 0 1 29.33 52.76ZM38 25A6 6 0 1 0 26 25A6 6 0 1 0 38 25Z"
        fill="currentColor"
        fillRule="evenodd"
        mask={`url(#${mask})`}
      />
      <g transform="rotate(-18 32 32)">
        <path
          d="M13.66 25.76A27 8.5 0 1 0 53.28 37.23"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="57.68" cy="29.37" r="3.5" fill="currentColor" />
      </g>
    </svg>
  )
}
