/**
 * A real calendar date in `YYYY-MM-DD`, not merely a matching string.
 *
 * Shared by the session payload validator and the legacy import, which must
 * accept a historical date the session commit's clock window would reject.
 */
export function isLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  )
}
