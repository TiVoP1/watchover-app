import { describe, expect, it } from 'vitest'
import type { ToldSeries } from '#web/story/place-story.ts'
import { nearestPoint, plotFrame, plotX, plotY, TOLD_PLOT } from '#web/story/told-plot.ts'

const ground: ToldSeries = {
  label: 'centre',
  points: [
    { time: '2025-10-30T12:05:39Z', value: 0 },
    { time: '2026-04-28T12:05:39Z', value: -9.6 },
    { time: '2026-10-13T12:05:38Z', value: -19 },
  ],
}

const firm: ToldSeries = {
  label: 'firm',
  points: [
    { time: '2025-10-30T12:05:39Z', value: 0 },
    { time: '2026-10-13T12:05:38Z', value: 0.4 },
  ],
}

describe('plotFrame', () => {
  it('spans the dates of every series and rounds the values out to whole units through zero', () => {
    expect(plotFrame([ground, firm])).toEqual({
      first: Date.parse('2025-10-30T12:05:39Z'),
      last: Date.parse('2026-10-13T12:05:38Z'),
      low: -19,
      high: 1,
    })
  })

  it('keeps at least one unit of height and needs two points', () => {
    const flat: ToldSeries = { label: 'flat', points: firm.points.map((p) => ({ ...p, value: 0 })) }
    expect(plotFrame([flat])).toMatchObject({ low: 0, high: 1 })
    expect(plotFrame([{ label: 'one', points: firm.points.slice(0, 1) }])).toBeNull()
  })
})

describe('plotX and plotY', () => {
  const frame = plotFrame([ground, firm])
  if (frame === null) throw new Error('no frame')

  it('puts the first and last visit on the padded edges', () => {
    expect(plotX(frame, '2025-10-30T12:05:39Z')).toBe(TOLD_PLOT.pad)
    expect(plotX(frame, '2026-10-13T12:05:38Z')).toBe(TOLD_PLOT.width - TOLD_PLOT.pad)
  })

  it('draws the highest value at the top and the lowest at the bottom', () => {
    expect(plotY(frame, frame.high)).toBe(TOLD_PLOT.pad)
    expect(plotY(frame, frame.low)).toBe(TOLD_PLOT.height - TOLD_PLOT.pad)
  })
})

describe('nearestPoint', () => {
  it('picks the visit closest to the pointer', () => {
    const frame = plotFrame([ground])
    if (frame === null) throw new Error('no frame')
    expect(nearestPoint(frame, ground.points, 0)).toBe(0)
    expect(nearestPoint(frame, ground.points, TOLD_PLOT.width / 2)).toBe(1)
    expect(nearestPoint(frame, ground.points, TOLD_PLOT.width)).toBe(2)
  })
})
