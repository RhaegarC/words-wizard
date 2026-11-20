import { readFileSync } from "node:fs"

import { beforeAll, describe, expect, it } from "vitest"

import type { BadgeDefinition, BadgeFacts } from "@shared/badges"
import type { ContentBundle } from "@shared/content/types"
import type { Topic } from "@shared/types"

import { loadContent } from "../../content"
import { badgeCatalogueFor, badgeCopy, badgeCopyForId } from "../../domain/badgeView"
import { createTranslator, type Dictionary } from "../../i18n/messages"

function readLocale(locale: "en" | "zh"): Dictionary {
  const url = new URL(`../../i18n/locales/${locale}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, "utf8")) as Dictionary
}

const en = readLocale("en")
const zh = readLocale("zh")

function makeTopic(id: string, title: string, titleZh: string): Topic {
  return {
    id,
    title,
    titleZh,
    icon: "🌲",
    description: "",
    descriptionZh: "",
    sortOrder: 1,
  }
}

const TOPICS = [
  makeTopic("t1", "Forest", "森林"),
  makeTopic("t2", "Ocean", "海洋"),
]

const BUNDLE: ContentBundle = {
  meta: { schemaVersion: 1, dataset: "dev", contentVersion: "1.0.0" },
  topics: TOPICS,
  packs: [],
  words: [],
  avatars: [],
}

const NO_FACTS: BadgeFacts = {
  wordsLearned: 0,
  wordsMastered: 0,
  bestStreak: 0,
  completedSessions: 0,
  monthlyReviews: 0,
  completedTopicIds: [],
}

beforeAll(() => {
  loadContent(BUNDLE)
})

describe("badgeCatalogueFor", () => {
  it("adds one trophy per live topic, in content order", () => {
    const catalogue = badgeCatalogueFor(NO_FACTS)
    const trophies = catalogue.filter((entry) => entry.tier === "trophy")

    expect(trophies.map((entry) => entry.topicId)).toEqual(["t1", "t2"])
    expect(catalogue).toHaveLength(15 + TOPICS.length)
  })

  it("keeps a completed topic's trophy after the topic leaves the course", () => {
    const catalogue = badgeCatalogueFor({
      ...NO_FACTS,
      completedTopicIds: ["t1", "gone"],
    })

    expect(
      catalogue
        .filter((entry) => entry.tier === "trophy")
        .map((entry) => entry.topicId),
    ).toEqual(["t1", "t2", "gone"])
  })
})

describe("badgeCopy", () => {
  it("names a live trophy after its topic in both locales", () => {
    const definition = badgeCatalogueFor(NO_FACTS).find(
      (entry) => entry.topicId === "t1",
    ) as BadgeDefinition

    expect(badgeCopy(definition, "en", createTranslator("en", en, en))).toEqual({
      name: "Forest trophy",
      description: "Complete the Forest exam.",
    })
    expect(badgeCopy(definition, "zh", createTranslator("zh", zh, en))).toEqual({
      name: "森林奖杯",
      description: "通过森林考试。",
    })
  })

  it("uses the generic copy for a trophy whose topic is gone", () => {
    const definition: BadgeDefinition = {
      id: "topic.gone",
      category: "topics",
      tier: "trophy",
      threshold: null,
      fact: "completedTopicIds",
      topicId: "gone",
    }

    expect(
      badgeCopy(definition, "en", createTranslator("en", en, en)),
    ).toEqual({
      name: "Completed topic",
      description: "A topic you completed is no longer in the course.",
    })
  })
})

describe("badgeCopyForId", () => {
  const t = createTranslator("en", en, en)

  it("resolves a medal, a live trophy and an archived trophy", () => {
    expect(badgeCopyForId("streak.gold", "en", t).name).toBe("Thirty-Day Streak")
    expect(badgeCopyForId("topic.t2", "en", t).name).toBe("Ocean trophy")
    expect(badgeCopyForId("topic.gone", "en", t).name).toBe("Completed topic")
  })

  it("falls back to the id rather than throwing on an unknown badge", () => {
    expect(badgeCopyForId("unknown.badge", "en", t)).toEqual({
      name: "unknown.badge",
      description: "",
    })
  })
})
