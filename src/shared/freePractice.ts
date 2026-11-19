import { config } from "./config"
import {
  assignSessionWords,
  unlockedPacksFor,
  type SessionPlan,
  type SessionSeed,
} from "./session"
import type { IntroductionWrite } from "./provider"
import type { Pack, Profile, Progress, Word } from "./types"

/**
 * Feature 34. Free Practice revisits one unlocked pack of the current topic.
 *
 * Only words already introduced in that pack are eligible. An introduction is
 * written by a committed session that also writes the word's progress row, so
 * filtering on both keeps the invariant that a free session adds no progress
 * row and no `word.learned` event. The session is otherwise a normal session:
 * the caller commits it through the existing path.
 */

export { unlockedPacksFor } from "./session"

export interface BuildFreePracticeInput {
  profile: Pick<Profile, "id" | "currentTopicId">
  packs: readonly Pack[]
  words: readonly Word[]
  progress: readonly Progress[]
  introductions: readonly IntroductionWrite[]
  /** The pack chosen on the free-practice screen. */
  packId: string
  seed: SessionSeed
  speechAvailable: boolean
}

const EMPTY_PLAN: SessionPlan = {
  words: [],
  caughtUp: true,
  introductions: [],
}

export function buildFreePractice(input: BuildFreePracticeInput): SessionPlan {
  const pack = unlockedPacksFor(
    input.profile.currentTopicId,
    input.packs,
    input.introductions,
  ).find((candidate) => candidate.id === input.packId)

  if (pack === undefined) {
    return EMPTY_PLAN
  }

  const introduced = new Set(
    input.introductions
      .filter((row) => row.packId === pack.id)
      .map((row) => row.wordId),
  )
  const withProgress = new Set(
    input.progress
      .filter((row) => row.profileId === input.profile.id)
      .map((row) => row.wordId),
  )
  const inContent = new Set(input.words.map((word) => word.id))

  const wordIds = [...new Set(pack.wordIds)]
    .filter(
      (wordId) =>
        inContent.has(wordId) &&
        introduced.has(wordId) &&
        withProgress.has(wordId),
    )
    .slice(0, config.freePractice.cap)

  if (wordIds.length === 0) {
    return EMPTY_PLAN
  }

  return {
    words: assignSessionWords(
      wordIds.map((wordId) => ({ wordId, kind: "review" as const })),
      input.seed,
      input.speechAvailable,
    ),
    caughtUp: false,
    introductions: [],
  }
}
