import { defaultDb } from "../db/db"
import { METRIC_NAMES } from "@shared/metrics"
import type { ProgressProvider } from "@shared/provider"

/**
 * Dev-only helpers for the route table, used until feature 06 creates a real
 * character. They exercise the same provider the app uses, so seeding is also
 * a quick manual check of the commit transaction.
 */
export async function seedDevProfile(
  provider: ProgressProvider,
): Promise<void> {
  if (await provider.getProfile()) {
    return
  }

  const now = Date.now()
  const profile = await provider.createProfile({
    name: "",
    characterName: "Alex",
    avatar: "alex",
    currentTopicId: "craft-and-build",
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
    locale: "en",
  })

  if (profile.id === undefined) {
    throw new Error("The dev profile was created without an id")
  }

  await provider.commitSession({
    profileId: profile.id,
    now,
    xpEarned: 2,
    profile: { xp: 2, lastPracticeAt: now },
    progress: [
      {
        wordId: "w-bag",
        status: "learning",
        strength: 0.2,
        nextReviewAt: now + 86_400_000,
        correctCount: 1,
        wrongCount: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        masteryXpAwarded: false,
      },
    ],
    metrics: {
      [METRIC_NAMES.sessionStarted]: 1,
      [METRIC_NAMES.sessionCompleted]: 1,
    },
  })
}

/** Drop everything and reload as a first run; the next boot shows `#/create`. */
export async function resetDevDatabase(): Promise<void> {
  await defaultDb.delete()
}
