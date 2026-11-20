import type { BadgeCategory, BadgeDefinition } from "@shared/badges"

import type { MessageKey } from "../i18n/messages"

/**
 * Feature 37. The catalogue carries ids, not copy, so every badge label lives
 * in both locale files and a missing one is a typed-key failure rather than an
 * untranslated string at runtime.
 */

export const BADGE_CATEGORY_KEYS: Readonly<
  Record<BadgeCategory, MessageKey>
> = {
  collection: "badges.category.collection",
  mastery: "badges.category.mastery",
  streak: "badges.category.streak",
  sessions: "badges.category.sessions",
  reviews: "badges.category.reviews",
  topics: "badges.category.topics",
}

export const MEDAL_NAME_KEYS: Readonly<Record<string, MessageKey>> = {
  "collection.bronze": "badges.collection.bronze.name",
  "collection.silver": "badges.collection.silver.name",
  "collection.gold": "badges.collection.gold.name",
  "mastery.bronze": "badges.mastery.bronze.name",
  "mastery.silver": "badges.mastery.silver.name",
  "mastery.gold": "badges.mastery.gold.name",
  "streak.bronze": "badges.streak.bronze.name",
  "streak.silver": "badges.streak.silver.name",
  "streak.gold": "badges.streak.gold.name",
  "sessions.bronze": "badges.sessions.bronze.name",
  "sessions.silver": "badges.sessions.silver.name",
  "sessions.gold": "badges.sessions.gold.name",
  "reviews.bronze": "badges.reviews.bronze.name",
  "reviews.silver": "badges.reviews.silver.name",
  "reviews.gold": "badges.reviews.gold.name",
}

export const MEDAL_DESCRIPTION_KEYS: Readonly<Record<string, MessageKey>> = {
  "collection.bronze": "badges.collection.bronze.description",
  "collection.silver": "badges.collection.silver.description",
  "collection.gold": "badges.collection.gold.description",
  "mastery.bronze": "badges.mastery.bronze.description",
  "mastery.silver": "badges.mastery.silver.description",
  "mastery.gold": "badges.mastery.gold.description",
  "streak.bronze": "badges.streak.bronze.description",
  "streak.silver": "badges.streak.silver.description",
  "streak.gold": "badges.streak.gold.description",
  "sessions.bronze": "badges.sessions.bronze.description",
  "sessions.silver": "badges.sessions.silver.description",
  "sessions.gold": "badges.sessions.gold.description",
  "reviews.bronze": "badges.reviews.bronze.description",
  "reviews.silver": "badges.reviews.silver.description",
  "reviews.gold": "badges.reviews.gold.description",
}

/** A live trophy is named for its topic; the topic is a `{topic}` param. */
export const TROPHY_NAME_KEY: MessageKey = "badges.trophy.name"
export const TROPHY_DESCRIPTION_KEY: MessageKey = "badges.trophy.description"
export const TROPHY_ARCHIVED_NAME_KEY: MessageKey = "badges.trophy.archivedName"
export const TROPHY_ARCHIVED_DESCRIPTION_KEY: MessageKey =
  "badges.trophy.archivedDescription"

export function badgeNameKey(definition: BadgeDefinition): MessageKey {
  if (definition.tier === "trophy") {
    return TROPHY_NAME_KEY
  }

  const key = MEDAL_NAME_KEYS[definition.id]

  if (key === undefined) {
    throw new Error(`No name copy for badge "${definition.id}"`)
  }

  return key
}

export function badgeDescriptionKey(definition: BadgeDefinition): MessageKey {
  if (definition.tier === "trophy") {
    return TROPHY_DESCRIPTION_KEY
  }

  const key = MEDAL_DESCRIPTION_KEYS[definition.id]

  if (key === undefined) {
    throw new Error(`No description copy for badge "${definition.id}"`)
  }

  return key
}
