import { describe, expect, it } from "vitest"

import { METRIC_NAMES } from "../../shared/metrics"
import {
  MAX_BODY_BYTES,
  parseCareEvent,
  parseCreateProfile,
  parseJsonBody,
  parseMetricEvent,
  parseProfilePatch,
} from "../profileInput"

/**
 * Unit tier: the request body rules the profile, metric, and care routes
 * apply before any database call. Every boundary is asserted at the value and
 * one step past it, and an unknown field is a rejection rather than a silent
 * ignore, because a body carrying `oid` must never look accepted.
 */

const NOW = 1_760_000_000_000
const DAY = 24 * 60 * 60 * 1000

function create(overrides: Record<string, unknown> = {}) {
  return {
    characterName: "Mila",
    avatar: "alex",
    currentTopicId: null,
    locale: "en",
    now: NOW,
    ...overrides,
  }
}

describe("parseJsonBody", () => {
  // A JSON string of two quotes plus N characters is N + 2 bytes.
  const atBound = JSON.stringify("a".repeat(MAX_BODY_BYTES - 2))

  it("accepts a body at the 64 KB bound and refuses one byte past it", () => {
    expect(atBound).toHaveLength(MAX_BODY_BYTES)
    expect(parseJsonBody(undefined, atBound).ok).toBe(true)
    expect(parseJsonBody(undefined, `${atBound} `)).toMatchObject({
      ok: false,
      issue: "body-too-large",
    })
  })

  it("refuses from the declared length before reading the text", () => {
    expect(
      parseJsonBody(String(MAX_BODY_BYTES + 1), "{}"),
    ).toMatchObject({ ok: false, issue: "body-too-large" })
  })

  it("reports a non-JSON body as invalid JSON", () => {
    for (const text of ["", "not json", "{"]) {
      expect(parseJsonBody(undefined, text)).toMatchObject({
        ok: false,
        issue: "invalid-json",
      })
    }
  })
})

describe("parseCreateProfile", () => {
  it("accepts the documented body", () => {
    expect(parseCreateProfile(create(), NOW)).toEqual({
      ok: true,
      value: {
        characterName: "Mila",
        avatar: "alex",
        currentTopicId: null,
        locale: "en",
        now: NOW,
      },
    })
  })

  it("trims the name and counts code points", () => {
    expect(
      parseCreateProfile(create({ characterName: "  Milo  " }), NOW),
    ).toMatchObject({ ok: true, value: { characterName: "Milo" } })

    // 16 code points is the bound: an emoji is one code point, not two.
    const sixteen = "😀".repeat(16)
    expect(
      parseCreateProfile(create({ characterName: sixteen }), NOW).ok,
    ).toBe(true)
    expect(
      parseCreateProfile(create({ characterName: "😀".repeat(17) }), NOW),
    ).toMatchObject({ ok: false, issues: ["name-invalid"] })
  })

  it("refuses an empty name and a control character", () => {
    for (const characterName of ["", "   ", "Mi\nla", "Mi\u2028la"]) {
      expect(
        parseCreateProfile(create({ characterName }), NOW),
      ).toMatchObject({ ok: false, issues: ["name-invalid"] })
    }
  })

  it("refuses a body that is not an object", () => {
    for (const body of [null, "body", 42, []]) {
      expect(parseCreateProfile(body, NOW)).toMatchObject({
        ok: false,
        issues: ["invalid-payload"],
      })
    }
  })

  it("rejects an identity field rather than ignoring it", () => {
    for (const field of ["oid", "userId", "profileId", "id"]) {
      expect(
        parseCreateProfile(create({ [field]: "someone-else" }), NOW),
      ).toMatchObject({ ok: false, issues: ["unknown-field"] })
    }
  })

  it("requires a non-empty avatar, a nullable topic, and a known locale", () => {
    expect(
      parseCreateProfile(create({ avatar: "  " }), NOW),
    ).toMatchObject({ ok: false, issues: ["avatar-invalid"] })
    expect(
      parseCreateProfile(create({ currentTopicId: "  " }), NOW),
    ).toMatchObject({ ok: false, issues: ["topic-invalid"] })
    expect(
      parseCreateProfile(create({ currentTopicId: "t1" }), NOW),
    ).toMatchObject({ ok: true, value: { currentTopicId: "t1" } })

    for (const locale of ["fr", "", 42]) {
      expect(parseCreateProfile(create({ locale }), NOW)).toMatchObject({
        ok: false,
        issues: ["locale-invalid"],
      })
    }

    expect(parseCreateProfile(create({ locale: "zh" }), NOW).ok).toBe(true)
  })

  it("accepts now at exactly 24 hours and refuses one step past", () => {
    expect(parseCreateProfile(create({ now: NOW + DAY }), NOW).ok).toBe(true)
    expect(parseCreateProfile(create({ now: NOW - DAY }), NOW).ok).toBe(true)
    expect(
      parseCreateProfile(create({ now: NOW + DAY + 1 }), NOW),
    ).toMatchObject({ ok: false, issues: ["clock-out-of-range"] })
    expect(
      parseCreateProfile(create({ now: NOW - DAY - 1 }), NOW),
    ).toMatchObject({ ok: false, issues: ["clock-out-of-range"] })
    expect(parseCreateProfile(create({ now: Number.NaN }), NOW)).toMatchObject(
      { ok: false, issues: ["clock-out-of-range"] },
    )
  })
})

describe("parseProfilePatch", () => {
  it("accepts each editable field on its own", () => {
    expect(parseProfilePatch({ characterName: "Milo" })).toEqual({
      ok: true,
      value: { characterName: "Milo" },
    })
    expect(parseProfilePatch({ avatar: "cody" })).toEqual({
      ok: true,
      value: { avatar: "cody" },
    })
    expect(parseProfilePatch({ currentTopicId: "t1" })).toEqual({
      ok: true,
      value: { currentTopicId: "t1" },
    })
    expect(parseProfilePatch({ locale: "zh" })).toEqual({
      ok: true,
      value: { locale: "zh" },
    })
  })

  it("accepts null as clearing the topic", () => {
    expect(parseProfilePatch({ currentTopicId: null })).toEqual({
      ok: true,
      value: { currentTopicId: null },
    })
  })

  it("refuses an empty patch", () => {
    expect(parseProfilePatch({})).toMatchObject({
      ok: false,
      issues: ["empty-patch"],
    })
  })

  it("rejects a server-owned field as unknown", () => {
    for (const field of [
      "xp",
      "streakCount",
      "careTokens",
      "createdAt",
      "lastPracticeAt",
      "name",
      "oid",
      "profileId",
    ]) {
      expect(parseProfilePatch({ [field]: 1 })).toMatchObject({
        ok: false,
        issues: ["unknown-field"],
      })
    }
  })

  it("rejects a second field when the first is invalid", () => {
    expect(
      parseProfilePatch({ characterName: "", locale: "fr" }),
    ).toMatchObject({ ok: false, issues: ["name-invalid", "locale-invalid"] })
  })
})

describe("parseMetricEvent", () => {
  it("accepts a known metric and a positive delta", () => {
    expect(
      parseMetricEvent({
        name: METRIC_NAMES.wordLearned,
        delta: 2,
        eventId: "evt-1",
      }),
    ).toEqual({
      ok: true,
      value: { name: METRIC_NAMES.wordLearned, delta: 2, eventId: "evt-1" },
    })
  })

  it("rejects an unknown metric name", () => {
    expect(
      parseMetricEvent({ name: "made.up", delta: 1, eventId: "evt-1" }),
    ).toMatchObject({ ok: false, issues: ["metric-name-invalid"] })
  })

  it("allows only the signed review metric to be negative", () => {
    const signed = (delta: number) =>
      parseMetricEvent({
        name: METRIC_NAMES.reviewStrengthDelta,
        delta,
        eventId: "evt-1",
      })

    expect(signed(-0.5).ok).toBe(true)
    expect(signed(-1.1)).toMatchObject({
      ok: false,
      issues: ["metric-delta-invalid"],
    })
    expect(signed(1.1)).toMatchObject({
      ok: false,
      issues: ["metric-delta-invalid"],
    })

    expect(
      parseMetricEvent({
        name: METRIC_NAMES.wordLearned,
        delta: -1,
        eventId: "evt-1",
      }),
    ).toMatchObject({ ok: false, issues: ["metric-delta-invalid"] })
  })

  it("rejects a non-finite delta", () => {
    for (const delta of [Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expect(
        parseMetricEvent({
          name: METRIC_NAMES.wordLearned,
          delta,
          eventId: "evt-1",
        }),
      ).toMatchObject({ ok: false, issues: ["metric-delta-invalid"] })
    }
  })

  it("requires an event id of at most 64 characters", () => {
    for (const eventId of ["", "   ", "a".repeat(65), 7]) {
      expect(
        parseMetricEvent({
          name: METRIC_NAMES.wordLearned,
          delta: 1,
          eventId,
        }),
      ).toMatchObject({ ok: false, issues: ["event-id-invalid"] })
    }

    expect(
      parseMetricEvent({
        name: METRIC_NAMES.wordLearned,
        delta: 1,
        eventId: "a".repeat(64),
      }).ok,
    ).toBe(true)
  })

  it("rejects an extra identity field", () => {
    expect(
      parseMetricEvent({
        name: METRIC_NAMES.wordLearned,
        delta: 1,
        eventId: "evt-1",
        userId: "someone-else",
      }),
    ).toMatchObject({ ok: false, issues: ["unknown-field"] })
  })
})

describe("parseCareEvent", () => {
  it("accepts the two care actions", () => {
    for (const action of ["freeze", "quickWake"]) {
      expect(parseCareEvent({ action, eventId: "evt-1" })).toEqual({
        ok: true,
        value: { action, eventId: "evt-1" },
      })
    }
  })

  it("rejects any other action", () => {
    for (const action of ["wake", "", 42, null]) {
      expect(parseCareEvent({ action, eventId: "evt-1" })).toMatchObject({
        ok: false,
        issues: ["care-action-invalid"],
      })
    }
  })

  it("requires an event id and rejects an extra field", () => {
    expect(parseCareEvent({ action: "freeze" })).toMatchObject({
      ok: false,
      issues: ["event-id-invalid"],
    })
    expect(
      parseCareEvent({ action: "freeze", eventId: "evt-1", oid: "other" }),
    ).toMatchObject({ ok: false, issues: ["unknown-field"] })
  })
})
