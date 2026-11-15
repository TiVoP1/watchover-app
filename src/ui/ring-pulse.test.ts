import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOTION } from '#web/tokens.ts'
import { pulseRing } from '#web/ui/ring-pulse.ts'

const EASE_REVEAL = 'reveal-curve'

function stubBrowser(reduced: boolean) {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })
  vi.stubGlobal('document', { documentElement: {} })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => ` ${EASE_REVEAL}` }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pulseRing', () => {
  it('grows and fades the ring once over the pass duration', () => {
    stubBrowser(false)
    const animate = vi.fn<Element['animate']>()
    pulseRing({ animate }, 1.05, 1.36)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.05, 1.36)', opacity: 0 },
      ],
      { duration: MOTION.passMs, fill: 'forwards', easing: EASE_REVEAL },
    )
  })

  it('stays still under reduced motion, so only the sentence changes', () => {
    stubBrowser(true)
    const animate = vi.fn<Element['animate']>()
    pulseRing({ animate }, 2.4)
    expect(animate).not.toHaveBeenCalled()
  })
})
