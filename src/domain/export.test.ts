import { describe, expect, it } from "vitest"

import {
  buildExport,
  exportFileName,
  type ExportMeta,
} from "./export"
import type { Device, Metric, Profile, Progress } from "./types"

const META: ExportMeta = {
  schemaVersion: 1,
  contentVersion: "0.1.0",
  appVersion: "0.1.0",
}

const PROFILE: Profile = {
  id: 7,
  name: "Mia",
  characterName: "Mia",
  avatar: "luma",
  currentTopicId: "animals",
  xp: 120,
  createdAt: 1,
  lastPracticeAt: 2,
  lastWakeAt: null,
  frozenDays: 0,
  careTokens: 1,
  sessionsSinceLastToken: 2,
  completedSessions: 3,
  streakCount: 4,
  bestStreak: 5,
  lastStreakDate: "2026-01-01",
  lastMonthlyReviewAt: null,
  locale: "en",
}

const PROGRESS: Progress[] = [
  {
    id: 11,
    profileId: 7,
    wordId: "w-cat",
    status: "learning",
    strength: 0.6,
    nextReviewAt: 10,
    correctCount: 2,
    wrongCount: 1,
    firstSeenAt: 3,
    lastSeenAt: 4,
    masteryXpAwarded: false,
  },
  {
    profileId: 7,
    wordId: "w-dog",
    status: "mastered",
    strength: 0.9,
    nextReviewAt: 12,
    correctCount: 4,
    wrongCount: 0,
    firstSeenAt: 5,
    lastSeenAt: 6,
    masteryXpAwarded: true,
  },
]

const METRICS: Metric[] = [
  {
    id: 21,
    profileId: 7,
    name: "session.completed",
    value: 3,
    updatedAt: 7,
  },
  {
    profileId: 7,
    name: "word.learned",
    value: 9,
    updatedAt: 8,
  },
]

const DEVICE: Device[] = [
  { key: "lastBootAt", value: 9 },
  { key: "installed", value: true },
  { key: "neverWritten", value: undefined },
]

describe("buildExport", () => {
  it("carries the versions, timestamp, and every section", () => {
    const payload = buildExport({
      profile: PROFILE,
      progress: PROGRESS,
      metrics: METRICS,
      device: DEVICE,
      meta: META,
      now: 1_700_000_000_000,
    })

    expect(payload.schemaVersion).toBe(1)
    expect(payload.contentVersion).toBe("0.1.0")
    expect(payload.appVersion).toBe("0.1.0")
    expect(payload.exportedAt).toBe(1_700_000_000_000)
    expect(payload.profile).toEqual(PROFILE)
    expect(payload.progress).toEqual(PROGRESS)
    expect(payload.metrics).toEqual(METRICS)
    expect(payload.device).toEqual({ installed: true, lastBootAt: 9 })
  })

  it("is plain JSON: no functions, undefined values, or store objects", () => {
    const payload = buildExport({
      profile: PROFILE,
      progress: PROGRESS,
      metrics: METRICS,
      device: DEVICE,
      meta: META,
      now: 1_700_000_000_000,
    })

    // A round trip drops any undefined or function-valued key, so equality
    // proves every value serializes and survives unchanged.
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it("omits the profile id only when the profile has none", () => {
    const { id: _id, ...withoutId } = PROFILE
    const payload = buildExport({
      profile: withoutId,
      progress: PROGRESS,
      metrics: METRICS,
      device: DEVICE,
      meta: META,
      now: 1,
    })

    expect("id" in payload.profile).toBe(false)
  })

  it("keeps progress fields needed to inspect a word", () => {
    const payload = buildExport({
      profile: PROFILE,
      progress: PROGRESS,
      metrics: METRICS,
      device: DEVICE,
      meta: META,
      now: 1,
    })
    const word = payload.progress[0]

    expect(word).toMatchObject({
      wordId: "w-cat",
      status: "learning",
      strength: 0.6,
      correctCount: 2,
      wrongCount: 1,
      firstSeenAt: 3,
      lastSeenAt: 4,
    })
  })
})

describe("exportFileName", () => {
  it("uses the local date with zero padding", () => {
    expect(exportFileName(new Date(2026, 0, 2, 23, 30).getTime())).toBe(
      "words-wizard-backup-2026-01-02.json",
    )
    expect(exportFileName(new Date(2026, 11, 31, 0, 5).getTime())).toBe(
      "words-wizard-backup-2026-12-31.json",
    )
  })

  it("does not shift to the UTC day", () => {
    // 02:00 UTC on 2 January is still 1 January in New York.
    expect(exportFileName(Date.UTC(2026, 0, 2, 2, 0, 0))).toBe(
      "words-wizard-backup-2026-01-01.json",
    )
  })
})
