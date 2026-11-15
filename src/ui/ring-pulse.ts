import { MOTION } from '#web/tokens.ts'
import { prefersReducedMotion } from '#web/ui/reduced-motion.ts'

export function pulseRing(ring: Pick<Element, 'animate'>, scaleX: number, scaleY = scaleX): void {
  if (prefersReducedMotion()) return
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-reveal').trim()
  ring.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: `scale(${String(scaleX)}, ${String(scaleY)})`, opacity: 0 },
    ],
    { duration: MOTION.passMs, fill: 'forwards', ...(easing === '' ? {} : { easing }) },
  )
}
