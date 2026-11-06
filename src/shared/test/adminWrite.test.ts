import { describe, expect, it } from "vitest"

import {
  bumpContentVersion,
  checkProposal,
  packIdFor,
  parsePackCreate,
  parsePackOrder,
  parsePackPatch,
  parseTopicCreate,
  parseTopicOrder,
  parseTopicPatch,
  slugify,
  topicIdFor,
} from "../adminWrite"
import { STAGE_IDS } from "../types"
import type { ContentBundle } from "../content/types"

const TOPIC = {
  title: "Craft & Build",
  titleZh: "手工与建造",
  icon: "🔨",
  description: "Make things with your hands.",
  descriptionZh: "用双手做东西。",
}

function avatars(): ContentBundle["avatars"] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `avatar-${index}`,
    name: `Avatar ${index}`,
    nameZh: `伙伴 ${index}`,
    color: "#7059dc",
    pale: "#eeeafd",
    stages: Object.fromEntries(
      STAGE_IDS.map((stage) => [stage, `${index}-${stage}.png`]),
    ) as ContentBundle["avatars"][number]["stages"],
  }))
}

function bundle(
  overrides: Partial<Pick<ContentBundle, "topics" | "packs" | "words">> = {},
): ContentBundle {
  return {
    meta: { schemaVersion: 1, dataset: "dev", contentVersion: "0.3.0" },
    topics: [],
    packs: [],
    words: [],
    avatars: avatars(),
    ...overrides,
  }
}

describe("slugify", () => {
  it("lowercases and joins words with a single dash", () => {
    expect(slugify("Craft & Build")).toBe("craft-build")
    expect(slugify("Hello,   World!")).toBe("hello-world")
  })

  it("folds diacritics before slugging", () => {
    expect(slugify("Café au lait")).toBe("cafe-au-lait")
  })

  it("returns an empty slug for input with no Latin letters or digits", () => {
    expect(slugify("手工与建造")).toBe("")
    expect(slugify("---")).toBe("")
  })

  it("caps the length and never ends with a dash", () => {
    const slug = slugify(`${"a".repeat(40)} b`)

    expect(slug.length).toBe(40)
    expect(slug.endsWith("-")).toBe(false)
  })
})

describe("generated ids", () => {
  it("uses the title slug when it is free", () => {
    expect(topicIdFor("Craft & Build", new Set())).toBe("craft-build")
  })

  it("suffixes a collision from 2 upwards", () => {
    expect(topicIdFor("Craft & Build", new Set(["craft-build"]))).toBe(
      "craft-build-2",
    )
    expect(
      topicIdFor("Craft & Build", new Set(["craft-build", "craft-build-2"])),
    ).toBe("craft-build-3")
  })

  it("falls back to a numbered id for non-Latin titles", () => {
    expect(topicIdFor("手工与建造", new Set())).toBe("topic-1")
    expect(topicIdFor("手工与建造", new Set(["topic-1"]))).toBe("topic-2")
  })

  it("numbers packs from 1 and reuses the smallest free number", () => {
    expect(packIdFor("craft-build", new Set())).toBe("craft-build-1")
    expect(
      packIdFor("craft-build", new Set(["craft-build-1", "craft-build-3"])),
    ).toBe("craft-build-2")
  })

  it("counts archived ids, because the caller passes every row", () => {
    expect(packIdFor("craft-build", new Set(["craft-build-1"]))).toBe(
      "craft-build-2",
    )
  })
})

describe("content version", () => {
  it("bumps the patch component", () => {
    expect(bumpContentVersion("0.3.0")).toBe("0.3.1")
    expect(bumpContentVersion("1.9.9")).toBe("1.9.10")
  })

  it("falls back to a valid starting version for a malformed value", () => {
    expect(bumpContentVersion("draft")).toBe("0.0.1")
    expect(bumpContentVersion("1.2")).toBe("0.0.1")
  })
})

describe("topic request rules", () => {
  it("accepts and trims a complete create body", () => {
    const parsed = parseTopicCreate({ ...TOPIC, title: "  Craft & Build  " })

    expect(parsed).toEqual({
      ok: true,
      value: { ...TOPIC, title: "Craft & Build" },
    })
  })

  it("rejects an unknown field", () => {
    const parsed = parseTopicCreate({ ...TOPIC, id: "chosen-by-client" })

    expect(parsed.ok).toBe(false)
    expect(parsed.ok === false && parsed.issues).toContain("unknown-field")
  })

  it("rejects every required field when it is missing or blank", () => {
    for (const field of [
      "title",
      "titleZh",
      "icon",
      "description",
      "descriptionZh",
    ] as const) {
      const parsed = parseTopicCreate({ ...TOPIC, [field]: "   " })

      expect(parsed.ok, field).toBe(false)
    }
  })

  it("rejects a body that is not an object", () => {
    expect(parseTopicCreate([])).toEqual({
      ok: false,
      issues: ["invalid-payload"],
    })
  })

  it("accepts a partial edit and rejects an empty one", () => {
    expect(parseTopicPatch({ title: "Renamed" })).toEqual({
      ok: true,
      value: { title: "Renamed" },
    })
    expect(parseTopicPatch({})).toEqual({
      ok: false,
      issues: ["empty-patch"],
    })
  })

  it("rejects the generated id in an edit body", () => {
    const parsed = parseTopicPatch({ id: "craft-build" })

    expect(parsed.ok).toBe(false)
    expect(parsed.ok === false && parsed.issues).toContain("unknown-field")
  })
})

describe("pack request rules", () => {
  it("requires a topic id and both titles", () => {
    expect(
      parsePackCreate({
        topicId: "craft-build",
        title: "My Workshop",
        titleZh: "我的工坊",
      }),
    ).toEqual({
      ok: true,
      value: {
        topicId: "craft-build",
        title: "My Workshop",
        titleZh: "我的工坊",
      },
    })

    expect(
      parsePackCreate({ title: "My Workshop", titleZh: "我的工坊" }).ok,
    ).toBe(false)
  })

  it("keeps the topic immutable in an edit", () => {
    const parsed = parsePackPatch({
      topicId: "another-topic",
      title: "Renamed",
    })

    expect(parsed.ok).toBe(false)
    expect(parsed.ok === false && parsed.issues).toContain("unknown-field")
  })

  it("accepts a title-only edit", () => {
    expect(parsePackPatch({ titleZh: "新标题" })).toEqual({
      ok: true,
      value: { titleZh: "新标题" },
    })
  })
})

describe("order request rules", () => {
  it("accepts a list of ids", () => {
    expect(parseTopicOrder({ ids: ["b", "a"] })).toEqual({
      ok: true,
      value: { ids: ["b", "a"] },
    })
  })

  it("rejects a duplicate or non-string id", () => {
    const duplicate = parseTopicOrder({ ids: ["a", "a"] })

    expect(duplicate.ok).toBe(false)
    expect(duplicate.ok === false && duplicate.issues).toContain("duplicate-id")
    expect(parseTopicOrder({ ids: ["a", 2] }).ok).toBe(false)
  })

  it("requires the topic for a pack order", () => {
    expect(
      parsePackOrder({ topicId: "craft-build", ids: ["p-2", "p-1"] }),
    ).toEqual({
      ok: true,
      value: { topicId: "craft-build", ids: ["p-2", "p-1"] },
    })
    expect(parsePackOrder({ ids: ["p-1"] }).ok).toBe(false)
  })
})

describe("checkProposal", () => {
  it("downgrades an empty topic and an empty pack to warnings", () => {
    const result = checkProposal(
      bundle({
        topics: [
          {
            id: "craft-build",
            title: "Craft & Build",
            titleZh: "手工与建造",
            icon: "🔨",
            description: "d",
            descriptionZh: "d",
            sortOrder: 1,
          },
        ],
        packs: [
          {
            id: "craft-build-1",
            topicId: "craft-build",
            title: "My Workshop",
            titleZh: "我的工坊",
            wordIds: [],
            order: 1,
          },
        ],
      }),
    )

    expect(result.errors).toEqual([])
    expect(result.warnings.map((issue) => issue.code)).toContain(
      "pack-no-words",
    )
  })

  it("keeps a structural finding as an error", () => {
    const result = checkProposal(
      bundle({
        packs: [
          {
            id: "orphan-pack",
            topicId: "missing-topic",
            title: "Orphan",
            titleZh: "孤儿",
            wordIds: [],
            order: 1,
          },
        ],
      }),
    )

    expect(result.errors.map((issue) => issue.code)).toContain(
      "pack-topic-ref",
    )
  })
})
