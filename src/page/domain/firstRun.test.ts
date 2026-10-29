import { beforeAll, describe, expect, it } from "vitest"

import type { Avatar, ContentBundle } from "@shared/content/types"
import { STAGE_IDS, type Topic } from "@shared/types"

import { loadContent } from "../content"
import {
  buildNewProfile,
  resolveTopicChoice,
  validateAvatarId,
  validateCharacterName,
} from "./firstRun"

const NOW = 1_760_000_000_000

const AVATAR_IDS = ["alex", "cody", "creeper", "malenia", "may", "steve"]

function makeAvatar(id: string): Avatar {
  return {
    id,
    name: id,
    nameZh: id,
    color: "#000000",
    pale: "#ffffff",
    stages: Object.fromEntries(
      STAGE_IDS.map((stage) => [stage, `${id}-${stage}.webp`]),
    ) as Avatar["stages"],
  }
}

const TOPIC: Topic = {
  id: "craft-and-build",
  title: "Craft & Build",
  titleZh: "建造",
  icon: "🔨",
  description: "Things to make.",
  descriptionZh: "做东西。",
  sortOrder: 1,
}

const BUNDLE: ContentBundle = {
  meta: { schemaVersion: 1, dataset: "dev", contentVersion: "1.0.0" },
  topics: [TOPIC],
  packs: [],
  words: [],
  avatars: AVATAR_IDS.map(makeAvatar),
}

beforeAll(() => {
  loadContent(BUNDLE)
})

describe("validateCharacterName", () => {
  it("rejects an empty name", () => {
    expect(validateCharacterName("")).toEqual({
      ok: false,
      reason: "empty",
    })
  })

  it("rejects a whitespace-only name", () => {
    expect(validateCharacterName("   ")).toEqual({
      ok: false,
      reason: "empty",
    })
  })

  it("accepts a single character", () => {
    expect(validateCharacterName("A")).toEqual({ ok: true, value: "A" })
  })

  it("accepts exactly 16 characters", () => {
    expect(validateCharacterName("abcdefghijklmnop")).toEqual({
      ok: true,
      value: "abcdefghijklmnop",
    })
  })

  it("rejects 17 characters", () => {
    expect(validateCharacterName("abcdefghijklmnopq")).toEqual({
      ok: false,
      reason: "too-long",
    })
  })

  it("accepts a 16-character Chinese name", () => {
    const name = "一二三四五六七八九十一二三四五六"

    expect([...name]).toHaveLength(16)
    expect(validateCharacterName(name)).toEqual({ ok: true, value: name })
  })

  it("counts an emoji as one code point, not two UTF-16 units", () => {
    const fifteen = "🦄".repeat(15)

    expect(validateCharacterName(`${fifteen}A`)).toEqual({
      ok: true,
      value: `${fifteen}A`,
    })
    expect(validateCharacterName(`${fifteen}AB`)).toEqual({
      ok: false,
      reason: "too-long",
    })
  })

  it("trims surrounding spaces before accepting", () => {
    expect(validateCharacterName("  Mia  ")).toEqual({
      ok: true,
      value: "Mia",
    })
  })

  it("rejects a line break inside the name", () => {
    expect(validateCharacterName("Mi\na")).toEqual({
      ok: false,
      reason: "invalid-character",
    })
  })

  it("rejects a control character", () => {
    expect(validateCharacterName("Mi\u0001a")).toEqual({
      ok: false,
      reason: "invalid-character",
    })
  })
})

describe("validateAvatarId", () => {
  it.each(["alex", "cody", "creeper", "malenia", "may", "steve"])(
    "accepts %s",
    (id) => {
      const result = validateAvatarId(id)

      expect(result.ok).toBe(true)
      expect(result.ok && result.avatar.id).toBe(id)
    },
  )

  it.each(["../../evil", "", "Luma", "dragon"])("rejects %j", (id) => {
    expect(validateAvatarId(id)).toEqual({ ok: false })
  })
})

describe("buildNewProfile", () => {
  it("builds the PRD defaults for a new character", () => {
    expect(
      buildNewProfile(
        { characterName: "Mia", avatar: "luma" },
        NOW,
        "zh",
      ),
    ).toEqual({
      name: "Mia",
      characterName: "Mia",
      avatar: "luma",
      currentTopicId: null,
      xp: 0,
      createdAt: NOW,
      lastPracticeAt: NOW,
      lastWakeAt: null,
      frozenDays: 0,
      careTokens: 0,
      sessionsSinceLastToken: 0,
      completedSessions: 0,
      streakCount: 0,
      bestStreak: 0,
      lastStreakDate: null,
      lastMonthlyReviewAt: null,
      locale: "zh",
    })
  })

  it("starts the dormancy clock at creation", () => {
    const profile = buildNewProfile(
      { characterName: "Mia", avatar: "moss" },
      NOW,
      "en",
    )

    expect(profile.lastPracticeAt).toBe(profile.createdAt)
  })
})

describe("resolveTopicChoice", () => {
  it("accepts a topic that exists in the content set", () => {
    expect(resolveTopicChoice("craft-and-build")).toEqual({
      currentTopicId: "craft-and-build",
    })
  })

  it("rejects an unknown topic id", () => {
    expect(resolveTopicChoice("not-a-topic")).toBeNull()
    expect(resolveTopicChoice("../../etc")).toBeNull()
  })
})
