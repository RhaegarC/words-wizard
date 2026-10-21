import { describe, expect, it } from "vitest"

import { METRIC_NAMES, METRIC_NAME_VALUES } from "./metrics"

/**
 * The constants are the only way a counter is named (feature 05 AC), and the
 * export in feature 14 keys off these exact strings. A rename is a data
 * migration, so the list is pinned here rather than inferred.
 */
const PRD_15_COUNTERS = [
  "session.started",
  "session.completed",
  "session.abandoned",
  "word.learned",
  "word.mastered",
  "stage.up",
  "xp.earned",
  "collection.opened",
  "wordBook.opened",
  "monthlyReview.offered",
  "monthlyReview.completed",
  "monthlyReview.strengthDelta",
  "revival.session",
  "revival.quickWake",
]

describe("metric names", () => {
  it("names every PRD §15 counter exactly once", () => {
    expect([...METRIC_NAME_VALUES].sort()).toEqual([...PRD_15_COUNTERS].sort())
  })

  it("has no duplicate values", () => {
    expect(new Set(METRIC_NAME_VALUES).size).toBe(METRIC_NAME_VALUES.length)
  })

  it("uses dotted, lower-camel segments", () => {
    for (const name of METRIC_NAME_VALUES) {
      expect(name).toMatch(/^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*$/)
    }
  })

  it("exposes the constants under stable keys", () => {
    expect(METRIC_NAMES.sessionStarted).toBe("session.started")
    expect(METRIC_NAMES.wordMastered).toBe("word.mastered")
    expect(METRIC_NAMES.reviewStrengthDelta).toBe(
      "monthlyReview.strengthDelta",
    )
  })
})
