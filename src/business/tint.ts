import { LOS_RAMP } from '#web/tokens.ts'

type Rgb = readonly [red: number, green: number, blue: number]

const HEX = 16
const CHANNEL_MAX = 255

const rgbOf = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), HEX),
  Number.parseInt(hex.slice(3, 5), HEX),
  Number.parseInt(hex.slice(5, 7), HEX),
]

const channelHex = (value: number): string =>
  Math.round(Math.min(CHANNEL_MAX, Math.max(0, value)))
    .toString(HEX)
    .padStart(2, '0')

export function mixColour(from: string, to: string, share: number): string {
  const a = rgbOf(from)
  const b = rgbOf(to)
  const blend = (i: 0 | 1 | 2) => channelHex(a[i] + (b[i] - a[i]) * share)
  return `#${blend(0)}${blend(1)}${blend(2)}`
}

export function losColour(towardsFraction: number): string {
  const steps = LOS_RAMP.length - 1
  const at = ((Math.min(1, Math.max(-1, towardsFraction)) + 1) / 2) * steps
  const lower = Math.min(steps - 1, Math.floor(at))
  const from = LOS_RAMP[lower] ?? LOS_RAMP[0]
  const to = LOS_RAMP[lower + 1] ?? from
  return mixColour(from, to, at - lower)
}
