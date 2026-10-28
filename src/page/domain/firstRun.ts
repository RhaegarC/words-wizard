import { getAvatarSet, getTopic } from "../content"
import type { Avatar } from "@shared/content/types"
import type { Locale, Profile } from "@shared/types"

/** PRD §7.0 and feature 06: the name bound is 16 Unicode code points. */
export const MAX_CHARACTER_NAME_CODE_POINTS = 16

export type NameRejection = "empty" | "too-long" | "invalid-character"

export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: NameRejection }

export type AvatarValidation = { ok: true; avatar: Avatar } | { ok: false }

export type NewCharacterInput = {
  characterName: string
  avatar: string
}

// C0/C1 controls cover newlines, tabs, and the other characters a name field
// should never accept. Unicode line/paragraph separators are not controls but
// read as line breaks, so they are rejected with them.
const CONTROL_OR_LINE_BREAK =
  /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u

/**
 * Trim, then count code points rather than UTF-16 units: a Chinese character
 * and an emoji each count once, so the bound matches what a child sees.
 */
export function validateCharacterName(raw: string): NameValidation {
  const value = raw.trim()

  if (value === "") {
    return { ok: false, reason: "empty" }
  }

  if (CONTROL_OR_LINE_BREAK.test(value)) {
    return { ok: false, reason: "invalid-character" }
  }

  if ([...value].length > MAX_CHARACTER_NAME_CODE_POINTS) {
    return { ok: false, reason: "too-long" }
  }

  return { ok: true, value }
}

/** Only an id from the bundled avatar set may be stored. */
export function validateAvatarId(id: string): AvatarValidation {
  const avatar = getAvatarSet().find((entry) => entry.id === id)

  return avatar ? { ok: true, avatar } : { ok: false }
}

/**
 * A fresh profile with every PRD §8.3 default. The topic is deliberately null:
 * the picker sets it, and Home must not guess one.
 */
export function buildNewProfile(
  input: NewCharacterInput,
  now: number,
  locale: Locale,
): Omit<Profile, "id"> {
  return {
    name: input.characterName,
    characterName: input.characterName,
    avatar: input.avatar,
    currentTopicId: null,
    xp: 0,
    createdAt: now,
    lastPracticeAt: now,
    lastWakeAt: null,
    frozenDays: 0,
    careTokens: 0,
    sessionsSinceLastToken: 0,
    completedSessions: 0,
    streakCount: 0,
    bestStreak: 0,
    lastStreakDate: null,
    lastMonthlyReviewAt: null,
    locale,
  }
}

/**
 * The profile patch for a topic choice, or null when the id is not in the
 * bundled content. Screens never write a raw id from a click.
 */
export function resolveTopicChoice(topicId: string): {
  currentTopicId: string
} | null {
  return getTopic(topicId) ? { currentTopicId: topicId } : null
}
