/**
 * Every tunable in one place, exactly as PRD §12.
 *
 * Domain code reads these values; nothing else hard-codes a threshold, cap, or interval.
 */
export const config = {
  xp: { firstTry: 2, afterHint: 1, mastered: 10, sessionComplete: 5 },
  stages: [
    { id: "egg", minXp: 0 },
    { id: "hatchling", minXp: 50 },
    { id: "juvenile", minXp: 300 },
    { id: "adult", minXp: 900 },
    { id: "legendary", minXp: 2000 },
  ],
  dormancy: { sleepyDay: 4, sleepDay: 7, vitalityPerDay: 15 },
  streak: { graceDays: 7, tokenCoversDays: 1 },
  careTokens: { sessionsPerToken: 5, cap: 3 },
  session: { reviewCap: 5, newWords: 4, newWordExercises: 2, maxWords: 9 },
  scheduler: {
    correctDelta: 0.2,
    wrongDelta: -0.3,
    masteredStrength: 0.8,
    masteredCorrect: 3,
    demoteStrength: 0.5,
    intervals: [1, 2, 4, 7, 14, 30],
  },
  monthlyReview: {
    intervalDays: 28,
    minLearned: 5,
    cap: 20,
    highStrengthConfirmations: 3,
  },
  unlock: { pack2: 15, pack3: 30 },
  speech: { rate: 0.85, pitch: 1.0 },
} as const

export type Config = typeof config
