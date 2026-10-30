import { getAvatarSet, getTopic } from "../content"
import type { Avatar } from "@shared/content/types"
import type { Locale, Profile } from "@shared/types"

// The name rule is shared with the Worker's profile routes (feature 23).
export {
  MAX_CHARACTER_NAME_CODE_POINTS,
  validateCharacterName,
} from "@shared/characterName"
export type { NameRejection, NameValidation } from "@shared/characterName"

export type AvatarValidation = { ok: true; avatar: Avatar } | { ok: false }

export type NewCharacterInput = {
  characterName: string
  avatar: string
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
