import { describe, expect, it } from "vitest"

import type { TopicExamState } from "../exam"
import type { IntroductionWrite } from "../provider"
import {
  TOPIC_STATUSES,
  deriveTopicStatus,
  type DeriveTopicStatusInput,
} from "../topicStatus"
import type { Pack } from "../types"

function makePack(
  id: string,
  topicId: string,
  wordIds: string[],
  order = 1,
): Pack {
  return {
    id,
    title: id,
    titleZh: id,
    topicId,
    wordIds,
    order,
  }
}

function introduction(packId: string, wordId: string): IntroductionWrite {
  return { packId, wordId }
}

function exam(topicId: string, completedAt: number | null): TopicExamState {
  return {
    topicId,
    passedParts: completedAt === null ? 0 : 1,
    partCount: 1,
    contentVersion: "v1",
    attempts: completedAt === null ? 0 : 1,
    lastAttemptAt: completedAt,
    completedAt,
  }
}

const PACKS = [
  makePack("p1", "t1", ["w1", "w2"], 1),
  makePack("p2", "t1", ["w2", "w3"], 2),
  makePack("p3", "t2", ["w9"], 1),
]

function derive(
  overrides: Partial<DeriveTopicStatusInput> = {},
): ReturnType<typeof deriveTopicStatus> {
  return deriveTopicStatus({
    topicId: "t1",
    packs: PACKS,
    introductions: [],
    exams: [],
    ...overrides,
  })
}

describe("deriveTopicStatus", () => {
  it("exposes the three statuses", () => {
    expect(TOPIC_STATUSES).toEqual(["none", "learning", "completed"])
  })

  it("is None before any word in the topic is introduced", () => {
    expect(derive()).toBe("none")
    expect(derive({ introductions: [] })).toBe("none")
  })

  it("is Learning after one introduction in a live pack of the topic", () => {
    expect(
      derive({ introductions: [introduction("p1", "w1")] }),
    ).toBe("learning")
  })

  it("counts a word shared by several packs once and still says Learning", () => {
    expect(
      derive({
        introductions: [
          introduction("p1", "w2"),
          introduction("p2", "w2"),
        ],
      }),
    ).toBe("learning")
  })

  it("ignores an introduction for an unknown or archived pack", () => {
    expect(
      derive({ introductions: [introduction("archived-pack", "w1")] }),
    ).toBe("none")
  })

  it("ignores an introduction in another topic's pack", () => {
    expect(
      derive({ introductions: [introduction("p3", "w9")] }),
    ).toBe("none")
  })

  it("is Completed when the topic exam has completedAt", () => {
    expect(derive({ exams: [exam("t1", 1_000)] })).toBe("completed")
  })

  it("stays Completed without introductions and after more are added", () => {
    expect(
      derive({
        introductions: [],
        exams: [exam("t1", 1_000)],
      }),
    ).toBe("completed")

    expect(
      derive({
        introductions: [introduction("p1", "w1")],
        exams: [exam("t1", 1_000)],
      }),
    ).toBe("completed")
  })

  it("reads only the requested topic's exam state", () => {
    expect(derive({ exams: [exam("t2", 1_000)] })).toBe("none")
  })

  it("keeps Completed when the topic has no live packs left", () => {
    expect(
      derive({
        packs: [],
        introductions: [],
        exams: [exam("t1", 1_000)],
      }),
    ).toBe("completed")
    expect(derive({ packs: [], introductions: [] })).toBe("none")
  })
})
