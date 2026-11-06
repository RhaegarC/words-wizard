/**
 * Local-calendar day math. The child lives in a local day, not a UTC one, and
 * a day is not always 24 hours: both DST transitions would make a millisecond
 * division report the wrong count. Every comparison therefore starts at local
 * midnight and rounds the result.
 */

const DAY_MS = 86_400_000

/** Local midnight of the day `now` falls in. */
export function startOfLocalDay(now: number): number {
  const date = new Date(now)

  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** The local day the child is in, independent of the device's UTC offset. */
export function localDateKey(now: number): string {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${date.getFullYear()}-${month}-${day}`
}

/** Local midnight for a `YYYY-MM-DD` key. */
export function startOfLocalDayKey(key: string): number {
  const [year, month, day] = key.split("-").map(Number)

  return new Date(year, month - 1, day).getTime()
}

/** The same local time, `days` days away. Calendar arithmetic, not 24h steps. */
export function shiftLocalDays(now: number, days: number): number {
  const date = new Date(startOfLocalDay(now))

  date.setDate(date.getDate() + days)

  return date.getTime()
}

/**
 * Whole local days from `from` to `to`. Rounding absorbs the 23- and 25-hour
 * days a DST change creates; a timestamp in the past is negative, so callers
 * decide whether to clamp.
 */
export function daysSinceLocal(from: number, to: number): number {
  return Math.round((startOfLocalDay(to) - startOfLocalDay(from)) / DAY_MS)
}
