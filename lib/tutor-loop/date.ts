const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export type CountdownState = 'UPCOMING' | 'TODAY' | 'PASSED'

export interface CalendarDateParts {
  year: number
  month: number
  day: number
}

/**
 * Parses an ISO calendar date (`YYYY-MM-DD` or ISO timestamp prefix) without local timezone drift.
 */
export function parseCalendarDate(value: string | null | undefined): CalendarDateParts | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(trimmed)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

export function toCalendarDateUtc(value: string | null | undefined): Date | null {
  const parts = parseCalendarDate(value)
  if (!parts) return null
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

export function formatIsoCalendarDate(parts: CalendarDateParts): string {
  const y = String(parts.year).padStart(4, '0')
  const m = String(parts.month).padStart(2, '0')
  const d = String(parts.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns today's calendar date (`YYYY-MM-DD`) in the given IANA timezone (defaults to UTC).
 */
export function todayCalendarDate(timeZone = 'UTC', now: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const formatted = formatter.format(now)
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted
  } catch {
    // Fallback to UTC below
  }
  return formatIsoCalendarDate({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  })
}

export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const utc = toCalendarDateUtc(dateStr)
  if (!utc) return dateStr
  utc.setUTCDate(utc.getUTCDate() + Math.trunc(deltaDays))
  return formatIsoCalendarDate({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  })
}

/**
 * Signed difference in calendar days (`targetDate - baseDate`).
 */
export function diffCalendarDays(targetDateStr: string, baseDateStr: string): number {
  const target = toCalendarDateUtc(targetDateStr)
  const base = toCalendarDateUtc(baseDateStr)
  if (!target || !base) return 0
  return Math.round((target.getTime() - base.getTime()) / 86_400_000)
}

/**
 * Returns the ISO Monday–Sunday week (`from`, `to` as `YYYY-MM-DD`) containing `dateStr`.
 */
export function isoWeekRange(dateStr: string): { from: string; to: string } {
  const utc = toCalendarDateUtc(dateStr)
  if (!utc) return { from: dateStr, to: dateStr }
  const dayOfWeek = utc.getUTCDay() // 0 = Sun, 1 = Mon, ...
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const from = addCalendarDays(dateStr, offsetToMonday)
  const to = addCalendarDays(from, 6)
  return { from, to }
}

export interface FormatTutorDateOptions {
  includeYear?: boolean
  weekday?: boolean
}

/**
 * Canonical Tutor Loop date formatter: `"2 Mar 2027"`, `"13 Nov"`, `"Fri 13 Nov 2026"`.
 * Never uses bare `toLocaleDateString()`.
 */
export function formatTutorDate(
  value: string | null | undefined,
  options: FormatTutorDateOptions = {},
): string {
  const utc = toCalendarDateUtc(value)
  if (!utc) return ''
  const includeYear = options.includeYear ?? true
  const weekday = options.weekday ?? false
  const day = utc.getUTCDate()
  const month = MONTHS[utc.getUTCMonth()]
  const year = utc.getUTCFullYear()
  const prefix = weekday ? `${WEEKDAYS[utc.getUTCDay()]} ` : ''
  return includeYear ? `${prefix}${day} ${month} ${year}` : `${prefix}${day} ${month}`
}

export const formatCalendarDate = formatTutorDate
export const formatShortDate = (value: string | null | undefined) =>
  formatTutorDate(value, { includeYear: false })

/**
 * Formats an inclusive calendar date range (`"9 – 15 Nov 2026"`, `"Mon 9 – Sun 15 Nov"`).
 */
export function formatTutorDateRange(
  fromStr: string | null | undefined,
  toStr: string | null | undefined,
  options: FormatTutorDateOptions = {},
): string {
  const fromUtc = toCalendarDateUtc(fromStr)
  const toUtc = toCalendarDateUtc(toStr)
  if (!fromUtc && !toUtc) return ''
  if (!fromUtc) return formatTutorDate(toStr, options)
  if (!toUtc) return formatTutorDate(fromStr, options)

  const includeYear = options.includeYear ?? true
  const weekday = options.weekday ?? false
  const fromDay = fromUtc.getUTCDate()
  const toDay = toUtc.getUTCDate()
  const fromMonth = MONTHS[fromUtc.getUTCMonth()]
  const toMonth = MONTHS[toUtc.getUTCMonth()]
  const fromYear = fromUtc.getUTCFullYear()
  const toYear = toUtc.getUTCFullYear()
  const fromPrefix = weekday ? `${WEEKDAYS[fromUtc.getUTCDay()]} ` : ''
  const toPrefix = weekday ? `${WEEKDAYS[toUtc.getUTCDay()]} ` : ''

  if (fromYear === toYear && fromMonth === toMonth) {
    const suffix = includeYear ? ` ${toMonth} ${toYear}` : ` ${toMonth}`
    if (fromDay === toDay) return `${fromPrefix}${fromDay}${suffix}`
    return `${fromPrefix}${fromDay} – ${toPrefix}${toDay}${suffix}`
  }

  if (fromYear === toYear) {
    const yearSuffix = includeYear ? ` ${toYear}` : ''
    return `${fromPrefix}${fromDay} ${fromMonth} – ${toPrefix}${toDay} ${toMonth}${yearSuffix}`
  }

  return `${formatTutorDate(fromStr, { includeYear: true, weekday })} – ${formatTutorDate(toStr, { includeYear: true, weekday })}`
}

export const formatDateRange = formatTutorDateRange

/**
 * Formats a relative countdown (`"14 days left"`, `"1 day left"`, `"Today"`, `"Passed"`).
 */
export function formatCountdown(
  input: { daysLeft: number; state?: CountdownState } | number | null | undefined,
  explicitState?: CountdownState,
): string {
  if (input === null || input === undefined) return ''
  const daysLeft = typeof input === 'number' ? input : input.daysLeft
  const state = explicitState ?? (typeof input === 'number' ? undefined : input.state)
  if (state === 'PASSED' || daysLeft < 0) return 'Passed'
  if (state === 'TODAY' || daysLeft === 0) return 'Today'
  const clamped = Math.max(0, Math.trunc(daysLeft))
  return clamped === 1 ? '1 day left' : `${clamped} days left`
}

/**
 * Short countdown pill text (`"109 days"`, `"1 day"`, `"Today"`, `"Passed"`).
 */
export function formatCountdownShort(
  input: { daysLeft: number; state?: CountdownState } | number | null | undefined,
  explicitState?: CountdownState,
): string {
  if (input === null || input === undefined) return ''
  const daysLeft = typeof input === 'number' ? input : input.daysLeft
  const state = explicitState ?? (typeof input === 'number' ? undefined : input.state)
  if (state === 'PASSED' || daysLeft < 0) return 'Passed'
  if (state === 'TODAY' || daysLeft === 0) return 'Today'
  const clamped = Math.max(0, Math.trunc(daysLeft))
  return clamped === 1 ? '1 day' : `${clamped} days`
}

export function computeCountdown(
  targetDateStr: string | null | undefined,
  baseDateStr?: string,
  timeZone = 'UTC',
): { daysLeft: number; state: CountdownState; label: string; shortLabel: string } | null {
  if (!parseCalendarDate(targetDateStr)) return null
  const base = baseDateStr && parseCalendarDate(baseDateStr) ? baseDateStr : todayCalendarDate(timeZone)
  const diff = diffCalendarDays(targetDateStr!, base)
  const state: CountdownState = diff < 0 ? 'PASSED' : diff === 0 ? 'TODAY' : 'UPCOMING'
  const daysLeft = Math.max(0, diff)
  return {
    daysLeft,
    state,
    label: formatCountdown({ daysLeft: diff, state }),
    shortLabel: formatCountdownShort({ daysLeft: diff, state }),
  }
}

/**
 * Formats an ISO 8601 instant into a timezone-safe calendar date label (`"13 Nov 2026"`).
 */
export function formatTutorTimestamp(
  isoString: string | null | undefined,
  options: FormatTutorDateOptions & { timeZone?: string } = {},
): string {
  if (!isoString) return ''
  const direct = parseCalendarDate(isoString)
  if (direct && /^\d{4}-\d{2}-\d{2}$/.test(isoString.trim())) {
    return formatTutorDate(isoString, options)
  }
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) return ''
  const cal = todayCalendarDate(options.timeZone ?? 'UTC', parsed)
  return formatTutorDate(cal, options)
}
