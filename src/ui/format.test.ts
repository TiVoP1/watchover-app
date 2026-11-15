import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatDate,
  formatDateSpan,
  formatDateTime,
  formatGroupedFromFive,
  formatLocalTime,
  formatNumber,
  formatShortDate,
  formatSigned,
  formatUtcDate,
  formatUtcTime,
  formatWeekdayDate,
  plural,
  withUnit,
} from '#web/ui/format.ts'

const WARSAW = 'Europe/Warsaw'
const MEXICO = 'America/Mexico_City'
const KOLKATA = 'Asia/Kolkata'
const NBSP = '\u00a0'

describe('dates in the zone of the place', () => {
  it('shows the evening pass in Warsaw summer time and the dawn pass in winter time', () => {
    expect(formatLocalTime('2026-10-20T17:43:18Z', WARSAW)).toBe('19:43')
    expect(formatLocalTime('2025-12-25T03:21:58Z', WARSAW)).toBe('04:21')
    expect(formatDate('2026-10-20T17:43:18Z', WARSAW)).toBe('20 Oct 2026')
  })

  it('moves the day with the zone, never with the browser', () => {
    expect(formatDate('2025-12-31T23:30:00Z', WARSAW)).toBe('1 Jan 2026')
    expect(formatDate('2026-01-01T03:00:00Z', MEXICO)).toBe('31 Dec 2025')
    expect(formatShortDate('2026-06-22T20:00:00Z', KOLKATA)).toBe('23 Jun')
  })

  it('writes the date with the 24 h clock in one go', () => {
    expect(formatDateTime('2026-11-14T03:21:00Z', WARSAW)).toBe('14 Nov 2026, 04:21')
  })

  it('names the weekday of the next look without a comma', () => {
    expect(formatWeekdayDate('2026-11-19T03:13:36Z', WARSAW)).toBe('Thu 19 Nov')
  })

  it('keeps UTC only for the source lines', () => {
    expect(formatUtcTime('2026-10-20T17:43:18Z')).toBe('17:43')
    expect(formatUtcDate('2025-12-31T23:30:00Z')).toBe('31 Dec 2025')
  })

  it('adds whole days to an instant', () => {
    expect(addDays('2026-11-19T03:13:36Z', 14)).toBe('2026-12-03T03:13:36.000Z')
  })

  it('writes the year of a span once, or twice when the span crosses a new year', () => {
    const span = (from: string, to: string, zone: string) =>
      formatDateSpan(from, to, zone).map((date) => date.replaceAll(NBSP, ' '))
    expect(span('2026-06-18T09:58:36Z', '2026-06-30T09:58:35Z', 'UTC')).toEqual([
      '18 Jun',
      '30 Jun 2026',
    ])
    expect(span('2025-10-30T12:05:39Z', '2026-10-13T12:05:38Z', MEXICO)).toEqual([
      '30 Oct 2025',
      '13 Oct 2026',
    ])
    expect(span('2025-12-31T23:30:00Z', '2026-01-10T12:00:00Z', WARSAW)).toEqual([
      '1 Jan',
      '10 Jan 2026',
    ])
  })

  it('keeps each date of a span on one line', () => {
    const [from, to] = formatDateSpan('2025-10-30T12:05:39Z', '2026-10-13T12:05:38Z', MEXICO)
    expect(from).toBe(`30${NBSP}Oct${NBSP}2025`)
    expect(to).toBe(`13${NBSP}Oct${NBSP}2026`)
  })
})

describe('numbers', () => {
  it('uses the true minus sign and a fixed number of digits', () => {
    expect(formatNumber(-0.267, 2)).toBe('−0.27')
    expect(formatSigned(0.302, 2)).toBe('+0.30')
    expect(formatSigned(-5.1, 1)).toBe('−5.1')
  })

  it('groups digits only from five digits', () => {
    expect(formatGroupedFromFive(20000)).toBe('20,000')
    expect(formatGroupedFromFive(5000)).toBe('5000')
  })

  it('puts a non-breaking space before the unit', () => {
    expect(withUnit('4', 'mm')).toBe('4 mm')
  })

  it('picks the singular only for one', () => {
    expect(plural(1, 'change', 'changes')).toBe('change')
    expect(plural(5, 'change', 'changes')).toBe('changes')
    expect(plural(0, 'change', 'changes')).toBe('changes')
  })
})
