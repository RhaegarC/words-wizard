import { beforeAll, describe, expect, it } from "vitest"

import type { Avatar, ContentBundle } from "@shared/content/types"
import { STAGE_IDS } from "@shared/types"

import { loadContent } from "../content"
import { buildRecustomizePatch } from "./settings"

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

const BUNDLE: ContentBundle = {
  meta: { schemaVersion: 1, dataset: "dev", contentVersion: "1.0.0" },
  topics: [],
  packs: [],
  words: [],
  avatars: ["alex", "cody"].map(makeAvatar),
}

beforeAll(() => {
  loadContent(BUNDLE)
})

describe("buildRecustomizePatch", () => {
  it("trims the name and returns only the editable fields", () => {
    const result = buildRecustomizePatch({
      characterName: "  Mia  ",
      avatar: "alex",
    })

    expect(result).toEqual({
      ok: true,
      patch: { name: "Mia", characterName: "Mia", avatar: "alex" },
    })

    if (result.ok) {
      // createdAt, lastPracticeAt, progress, streak, and tokens are not part of
      // the patch, so re-customizing cannot reset them.
      expect(Object.keys(result.patch).sort()).toEqual([
        "avatar",
        "characterName",
        "name",
      ])
    }
  })

  it("accepts exactly 16 code points and rejects 17", () => {
    expect(
      buildRecustomizePatch({
        characterName: "abcdefghijklmnop",
        avatar: "alex",
      }).ok,
    ).toBe(true)

    expect(
      buildRecustomizePatch({
        characterName: "abcdefghijklmnopq",
        avatar: "alex",
      }),
    ).toEqual({ ok: false, reason: "too-long" })
  })

  it("counts Chinese characters as one code point each", () => {
    expect(
      buildRecustomizePatch({
        characterName: "一二三四五六七八九十一二三四五六",
        avatar: "cody",
      }).ok,
    ).toBe(true)
  })

  it("rejects an empty name", () => {
    expect(
      buildRecustomizePatch({ characterName: "   ", avatar: "alex" }),
    ).toEqual({ ok: false, reason: "empty" })
  })

  it("rejects an avatar outside the bundled set", () => {
    expect(
      buildRecustomizePatch({
        characterName: "Mia",
        avatar: "not-an-avatar",
      }),
    ).toEqual({ ok: false, reason: "avatar" })
  })

  it("rejects control characters in the name", () => {
    expect(
      buildRecustomizePatch({
        characterName: "Mia\nPippin",
        avatar: "alex",
      }),
    ).toEqual({ ok: false, reason: "invalid-character" })
  })
})
