import { describe, expect, it } from "vitest"

import {
  daysSinceLocal,
  localDateKey,
  shiftLocalDays,
  startOfLocalDay,
  startOfLocalDayKey,
} from "./time"

/**
 * The suite runs with `TZ=America/New_York` (vitest config), so these dates
 * exercise a negative UTC offset and both DST transitions rather than passing
 * by accident on a UTC machine.
 */
describe("local calendar time", () => {
  it("runs in a non-UTC zone with both DST offsets", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300)
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240)
  })

  it("starts the local day at local midnight", () => {
    const start = new Date(
      startOfLocalDay(new Date(2026, 9, 21, 23, 59).getTime()),
    )

    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(9)
    expect(start.getDate()).toBe(21)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
  })

  it("keys a timestamp by its local date", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
      "2026-01-05",
    )
    expect(localDateKey(new Date(2026, 9, 21, 0, 1).getTime())).toBe(
      "2026-10-21",
    )
  })

  it("resolves a local date key to its local midnight", () => {
    expect(startOfLocalDayKey("2026-01-05")).toBe(
      new Date(2026, 0, 5).getTime(),
    )
  })

  it("shifts by calendar days across a DST change", () => {
    const spring = new Date(2026, 2, 8, 12, 0).getTime()

    expect(localDateKey(shiftLocalDays(spring, -1))).toBe("2026-03-07")
    expect(localDateKey(shiftLocalDays(spring, 1))).toBe("2026-03-09")
  })

  it("counts zero across one local day", () => {
    const early = new Date(2026, 0, 5, 0, 1).getTime()
    const late = new Date(2026, 0, 5, 23, 59).getTime()

    expect(daysSinceLocal(early, late)).toBe(0)
  })

  it("counts one for the next local day", () => {
    const late = new Date(2026, 0, 5, 23, 59).getTime()
    const early = new Date(2026, 0, 6, 0, 1).getTime()

    expect(daysSinceLocal(late, early)).toBe(1)
  })

  it("counts two across a skipped night", () => {
    const from = new Date(2026, 0, 5, 23, 0).getTime()
    const to = new Date(2026, 0, 7, 8, 0).getTime()

    expect(daysSinceLocal(from, to)).toBe(2)
  })

  it("rounds a spring-forward day correctly", () => {
    // US DST starts 2026-03-08: the 8th is only 23 hours long.
    const from = new Date(2026, 2, 7, 23, 0).getTime()
    const to = new Date(2026, 2, 9, 0, 30).getTime()

    expect(daysSinceLocal(from, to)).toBe(2)
  })

  it("rounds a fall-back day correctly", () => {
    // US DST ends 2026-11-01: the 1st is 25 hours long.
    const from = new Date(2026, 9, 31, 23, 0).getTime()
    const to = new Date(2026, 10, 2, 0, 30).getTime()

    expect(daysSinceLocal(from, to)).toBe(2)
  })

  it("reports a negative count for a clock that went backwards", () => {
    const from = new Date(2026, 0, 7, 12, 0).getTime()
    const to = new Date(2026, 0, 5, 12, 0).getTime()

    expect(daysSinceLocal(from, to)).toBe(-2)
  })
})
