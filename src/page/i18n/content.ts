import type { Word } from "@shared/types"

import type { Locale } from "./locale"

/** Word content is authored in both languages; these pick the active one. */
export function wordMeaning(word: Word, locale: Locale): string {
  return locale === "zh" ? word.meaningZh : word.meaningEn
}

export function wordDefinition(word: Word, locale: Locale): string {
  return locale === "zh" ? word.definitionZh : word.definitionEn
}

export function wordExample(word: Word, locale: Locale, index = 0): string {
  const example = word.examples[index]

  if (!example) {
    return ""
  }

  return locale === "zh" ? example.zh : example.en
}
