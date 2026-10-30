import { describe, expect, it } from "vitest"

import { METRIC_NAMES, METRIC_NAME_VALUES } from "./metrics"

import { counterRows, formatBytes } from "./diagnostics"
import type { Metric } from "./types"

describe("formatBytes", () => {
  it("formats byte boundaries without losing the unit change", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(999)).toBe("999 B")
    expect(formatBytes(1024)).toBe("1.0 KB")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB")
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB")
  })

  it("returns null when the browser gives no number", () => {
    expect(formatBytes(null)).toBeNull()
    expect(formatBytes(Number.NaN)).toBeNull()
    expect(formatBytes(-1)).toBeNull()
  })
})

describe("counterRows", () => {
  it("lists every PRD §15 counter in a stable order, defaulting to zero", () => {
    const metrics: Metric[] = [
      {
        profileId: "profile-1",
        name: METRIC_NAMES.sessionCompleted,
        value: 3,
        updatedAt: 1,
      },
      {
        profileId: "profile-1",
        name: METRIC_NAMES.xpEarned,
        value: 42,
        updatedAt: 2,
      },
    ]

    const rows = counterRows(metrics)

    expect(rows.map((row) => row.name)).toEqual(METRIC_NAME_VALUES)
    expect(
      rows.find((row) => row.name === METRIC_NAMES.sessionCompleted)?.value,
    ).toBe(3)
    expect(rows.find((row) => row.name === METRIC_NAMES.xpEarned)?.value).toBe(
      42,
    )
    expect(
      rows.find((row) => row.name === METRIC_NAMES.wordLearned)?.value,
    ).toBe(0)
  })
})
