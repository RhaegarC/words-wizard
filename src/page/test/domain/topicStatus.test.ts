import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { TOPIC_STATUSES } from "@shared/topicStatus"

import { TOPIC_STATUS_KEYS } from "../../domain/topicStatus"
import { createTranslator } from "../../i18n/messages"

type Dictionary = Record<string, string>

function readLocale(locale: "en" | "zh"): Dictionary {
  const url = new URL(`../../i18n/locales/${locale}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, "utf8")) as Dictionary
}

const en = readLocale("en")
const zh = readLocale("zh")

describe("topic status copy", () => {
  it("has one label key for every status", () => {
    expect(Object.keys(TOPIC_STATUS_KEYS).sort()).toEqual(
      [...TOPIC_STATUSES].sort(),
    )
  })

  it("labels all three statuses in both locales", () => {
    const english = createTranslator("en", en, en)
    const chinese = createTranslator("zh", zh, en)

    expect(TOPIC_STATUSES.map((status) => english(TOPIC_STATUS_KEYS[status])))
      .toEqual(["None", "Learning", "Completed"])
    expect(TOPIC_STATUSES.map((status) => chinese(TOPIC_STATUS_KEYS[status])))
      .toEqual(["未开始", "学习中", "已完成"])
  })

  it("renders the exam gate copy in both locales", () => {
    const english = createTranslator("en", en, en)
    const chinese = createTranslator("zh", zh, en)

    expect(english("exam.gate", { introduced: 3, total: 5 })).toBe(
      "3 of 5 words introduced",
    )
    expect(chinese("exam.gate", { introduced: 3, total: 5 })).toBe(
      "已学 3/5 个单词",
    )
  })
})
