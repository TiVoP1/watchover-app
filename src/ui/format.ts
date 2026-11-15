const LOCALE = 'en-GB'
const DAY_MS = 86_400_000

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let found = formatters.get(key)
  if (found === undefined) {
    found = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone })
    formatters.set(key, found)
  }
  return found
}

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const WEEKDAY_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
}
const MONTH: Intl.DateTimeFormatOptions = { month: 'short' }
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }
const YEAR: Intl.DateTimeFormatOptions = { year: 'numeric' }
const CLOCK: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, ...CLOCK }
const PLURAL = new Intl.PluralRules(LOCALE)

export const formatDate = (iso: string, timeZone: string): string =>
  formatter(timeZone, DATE).format(new Date(iso))

export const formatShortDate = (iso: string, timeZone: string): string =>
  formatter(timeZone, SHORT_DATE).format(new Date(iso))

export const formatWeekdayDate = (iso: string, timeZone: string): string =>
  formatter(timeZone, WEEKDAY_DATE).format(new Date(iso)).replace(',', '')

export const formatMonth = (date: Date, timeZone: string): string =>
  formatter(timeZone, MONTH).format(date)

export const formatMonthYear = (iso: string, timeZone: string): string =>
  formatter(timeZone, MONTH_YEAR).format(new Date(iso))

const formatYear = (iso: string, timeZone: string): string =>
  formatter(timeZone, YEAR).format(new Date(iso))

export const formatLocalTime = (iso: string, timeZone: string): string =>
  formatter(timeZone, CLOCK).format(new Date(iso))

export const formatDateTime = (iso: string, timeZone: string): string =>
  formatter(timeZone, DATE_TIME).format(new Date(iso))

export const plural = (n: number, one: string, other: string): string =>
  PLURAL.select(n) === 'one' ? one : other

export const formatUtcTime = (iso: string): string => formatLocalTime(iso, 'UTC')

export const formatUtcDate = (iso: string): string => formatDate(iso, 'UTC')

export const addDays = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()

const NBSP = ' '

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace('-', '−')
}

const FIVE_DIGIT_GROUPS = new Intl.NumberFormat(LOCALE, { useGrouping: 'min2' })

export const formatGroupedFromFive = (value: number): string =>
  FIVE_DIGIT_GROUPS.format(value).replace('-', '−')

export function formatUpTo(value: number, digits: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits })
    .format(value)
    .replace('-', '−')
}

export const formatSigned = (value: number, digits = 0): string =>
  `${value > 0 ? '+' : ''}${formatNumber(value, digits)}`

export const withUnit = (value: string, unit: string): string => `${value}${NBSP}${unit}`

const unbroken = (text: string): string => text.replaceAll(' ', NBSP)

export function formatDateSpan(
  from: string,
  to: string,
  timeZone: string,
): readonly [from: string, to: string] {
  const date =
    formatYear(from, timeZone) === formatYear(to, timeZone) ? formatShortDate : formatDate
  return [unbroken(date(from, timeZone)), unbroken(formatDate(to, timeZone))]
}
