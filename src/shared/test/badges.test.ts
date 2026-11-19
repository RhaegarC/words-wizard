import { describe, expect, it } from "vitest"

import {
  MEDAL_CATEGORIES,
  MEDAL_DEFINITIONS,
  badgeFacts,
  badgeProgress,
  buildBadgeCatalogue,
  deriveBadges,
  factsAfterExamCompletion,
  factsAfterSession,
  featuredBadge,
  isBadgeUnlocked,
  isTopicTrophyId,
  newlyEarned,
  nextGoal,
  topicIdFromTrophy,
  topicTrophyId,
  type BadgeFacts,
} from "../badges"
import type { SessionCommitPayload } from "../provider"

const EMPTY: BadgeFacts = {
  wordsLearned: 0,
  wordsMastered: 0,
  bestStreak: 0,
  completedSessions: 0,
  monthlyReviews: 0,
  completedTopicIds: [],
}

function facts(overrides: Partial<BadgeFacts> = {}): BadgeFacts {
  return { ...EMPTY, ...overrides }
}

function medal(category: string, tier: string) {
  const found = MEDAL_DEFINITIONS.find(
    (definition) =>
      definition.category === category && definition.tier === tier,
  )

  if (found === undefined) {
    throw new Error(`No ${category} ${tier} medal`)
  }

  return found
}

describe("badge catalogue", () => {
  it("has fifteen medals, five categories of bronze, silver and gold", () => {
    expect(MEDAL_CATEGORIES).toEqual([
      "collection",
      "mastery",
      "streak",
      "sessions",
      "reviews",
    ])
    expect(MEDAL_DEFINITIONS).toHaveLength(15)

    for (const category of MEDAL_CATEGORIES) {
      expect(medal(category, "bronze")).toMatchObject({
        category,
        tier: "bronze",
        fact: expect.any(String),
        threshold: expect.any(Number),
      })
      expect(medal(category, "silver").threshold).toBeGreaterThan(
        medal(category, "bronze").threshold as number,
      )
      expect(medal(category, "gold").threshold).toBeGreaterThan(
        medal(category, "silver").threshold as number,
      )
    }
  })

  it("uses the thresholds from the feature table", () => {
    expect(
      MEDAL_DEFINITIONS.map(
        (definition) => `${definition.id}:${definition.threshold}`,
      ),
    ).toEqual([
      "collection.bronze:10",
      "collection.silver:50",
      "collection.gold:100",
      "mastery.bronze:1",
      "mastery.silver:10",
      "mastery.gold:50",
      "streak.bronze:3",
      "streak.silver:7",
      "streak.gold:30",
      "sessions.bronze:10",
      "sessions.silver:50",
      "sessions.gold:100",
      "reviews.bronze:1",
      "reviews.silver:5",
      "reviews.gold:12",
    ])
  })

  it("adds one trophy per live topic after the medals", () => {
    const catalogue = buildBadgeCatalogue(["t1", "t2", "t3", "t4", "t5"])

    expect(catalogue).toHaveLength(20)
    expect(catalogue.slice(0, 15)).toEqual(MEDAL_DEFINITIONS)

    const trophies = catalogue.slice(15)

    expect(trophies.map((definition) => definition.id)).toEqual([
      topicTrophyId("t1"),
      topicTrophyId("t2"),
      topicTrophyId("t3"),
      topicTrophyId("t4"),
      topicTrophyId("t5"),
    ])
    expect(trophies[0]).toMatchObject({
      category: "topics",
      tier: "trophy",
      threshold: null,
      fact: "completedTopicIds",
      topicId: "t1",
    })
    expect(new Set(catalogue.map((definition) => definition.id)).size).toBe(20)
  })

  it("names trophies by topic and can read the topic back", () => {
    const id = topicTrophyId("x-t1")

    expect(id).toBe("topic.x-t1")
    expect(isTopicTrophyId(id)).toBe(true)
    expect(isTopicTrophyId("collection.bronze")).toBe(false)
    expect(topicIdFromTrophy(id)).toBe("x-t1")
    expect(topicIdFromTrophy("collection.bronze")).toBeNull()
  })
})

describe("deriveBadges", () => {
  it("unlocks nothing before any progress", () => {
    expect(deriveBadges(EMPTY)).toEqual([])
  })

  const BOUNDARIES = [
    ["wordsLearned", "collection"],
    ["wordsMastered", "mastery"],
    ["bestStreak", "streak"],
    ["completedSessions", "sessions"],
    ["monthlyReviews", "reviews"],
  ] as const

  for (const [fact, category] of BOUNDARIES) {
    it(`unlocks ${category} only at the exact threshold`, () => {
      for (const tier of ["bronze", "silver", "gold"] as const) {
        const definition = medal(category, tier)
        const threshold = definition.threshold as number

        expect(
          isBadgeUnlocked(definition, facts({ [fact]: threshold - 1 })),
        ).toBe(false)
        expect(
          isBadgeUnlocked(definition, facts({ [fact]: threshold })),
        ).toBe(true)
        expect(
          isBadgeUnlocked(definition, facts({ [fact]: threshold + 1 })),
        ).toBe(true)
      }
    })
  }

  it("keeps an earned medal when another fact falls", () => {
    const earned = deriveBadges(facts({ wordsLearned: 12 }))

    expect(earned).toContain("collection.bronze")

    // Facts are monotonic in the product; a weaker word leaves the cumulative
    // counter alone and the medal with it.
    expect(deriveBadges(facts({ wordsLearned: 12 }))).toEqual(earned)
    expect(
      deriveBadges(facts({ wordsLearned: 12, wordsMastered: 0 })),
    ).toContain("collection.bronze")
  })

  it("returns unlocked ids in catalogue order", () => {
    expect(
      deriveBadges(
        facts({ wordsLearned: 100, wordsMastered: 1, bestStreak: 3 }),
      ),
    ).toEqual([
      "collection.bronze",
      "collection.silver",
      "collection.gold",
      "mastery.bronze",
      "streak.bronze",
    ])
  })

  it("adds a trophy per completed topic and never duplicates one", () => {
    expect(deriveBadges(facts({ completedTopicIds: ["t2", "t1"] }))).toEqual([
      topicTrophyId("t2"),
      topicTrophyId("t1"),
    ])
    expect(
      deriveBadges(facts({ completedTopicIds: ["t1", "t1"] })),
    ).toEqual([topicTrophyId("t1")])
  })

  it("keeps a trophy for a topic no longer in the live catalogue", () => {
    const unlocked = deriveBadges(facts({ completedTopicIds: ["archived"] }))
    const catalogue = buildBadgeCatalogue(["t1", "archived"])

    expect(unlocked).toEqual([topicTrophyId("archived")])
    expect(
      featuredBadge(facts({ completedTopicIds: ["archived"] }), catalogue)?.id,
    ).toBe(topicTrophyId("archived"))
  })
})

describe("featured badge", () => {
  const catalogue = buildBadgeCatalogue(["t1", "t2"])

  it("takes the highest-tier unlocked medal", () => {
    expect(
      featuredBadge(
        facts({ wordsLearned: 100, wordsMastered: 10, bestStreak: 3 }),
        catalogue,
      )?.id,
    ).toBe("collection.gold")
  })

  it("breaks a tier tie by catalogue order", () => {
    expect(
      featuredBadge(
        facts({ wordsLearned: 100, wordsMastered: 50 }),
        catalogue,
      )?.id,
    ).toBe("collection.gold")
  })

  it("falls back to the first unlocked trophy when no medal is unlocked", () => {
    expect(
      featuredBadge(facts({ completedTopicIds: ["t2"] }), catalogue)?.id,
    ).toBe(topicTrophyId("t2"))
  })

  it("is null when nothing is unlocked", () => {
    expect(featuredBadge(EMPTY, catalogue)).toBeNull()
  })
})

describe("next goal", () => {
  const catalogue = buildBadgeCatalogue(["t1", "t2"])

  it("picks the smallest remaining amount", () => {
    expect(nextGoal(EMPTY, catalogue)).toMatchObject({
      badge: { id: "mastery.bronze" },
      current: 0,
      target: 1,
      remaining: 1,
    })
  })

  it("breaks a remaining tie by catalogue order", () => {
    const goal = nextGoal(facts({ wordsLearned: 9 }), catalogue)

    expect(goal?.badge.id).toBe("collection.bronze")
    expect(goal?.remaining).toBe(1)
  })

  it("treats a locked trophy as one remaining", () => {
    const goal = nextGoal(
      facts({
        wordsLearned: 100,
        wordsMastered: 50,
        bestStreak: 30,
        completedSessions: 100,
        monthlyReviews: 12,
      }),
      catalogue,
    )

    expect(goal?.badge.id).toBe(topicTrophyId("t1"))
    expect(goal).toMatchObject({ current: 0, target: 1, remaining: 1 })
  })

  it("is null when the whole catalogue is unlocked", () => {
    expect(
      nextGoal(
        facts({
          wordsLearned: 100,
          wordsMastered: 50,
          bestStreak: 30,
          completedSessions: 100,
          monthlyReviews: 12,
          completedTopicIds: ["t1", "t2"],
        }),
        catalogue,
      ),
    ).toBeNull()
  })
})

describe("badgeProgress", () => {
  it("clamps a medal at its threshold", () => {
    expect(badgeProgress(medal("collection", "bronze"), facts({
      wordsLearned: 25,
    }))).toEqual({ current: 10, target: 10, remaining: 0 })

    expect(badgeProgress(medal("collection", "silver"), facts({
      wordsLearned: 25,
    }))).toEqual({ current: 25, target: 50, remaining: 25 })
  })

  it("counts a trophy as complete or one away", () => {
    const trophy = buildBadgeCatalogue(["t1"])[15]

    expect(badgeProgress(trophy, EMPTY)).toEqual({
      current: 0,
      target: 1,
      remaining: 1,
    })
    expect(
      badgeProgress(trophy, facts({ completedTopicIds: ["t1"] })),
    ).toEqual({ current: 1, target: 1, remaining: 0 })
  })
})

describe("newlyEarned", () => {
  it("returns the difference in catalogue order", () => {
    expect(
      newlyEarned(
        facts({ wordsLearned: 9, wordsMastered: 0 }),
        facts({ wordsLearned: 10, wordsMastered: 1 }),
      ),
    ).toEqual(["collection.bronze", "mastery.bronze"])
  })

  it("is empty when nothing crossed a threshold", () => {
    expect(
      newlyEarned(facts({ wordsLearned: 10 }), facts({ wordsLearned: 10 })),
    ).toEqual([])
  })

  it("includes a trophy completed by the result", () => {
    expect(
      newlyEarned(EMPTY, facts({ completedTopicIds: ["t1"] })),
    ).toEqual([topicTrophyId("t1")])
  })

  it("does not report an already-earned badge again", () => {
    expect(
      newlyEarned(
        facts({ completedTopicIds: ["t1"] }),
        facts({ completedTopicIds: ["t1"] }),
      ),
    ).toEqual([])
  })
})

describe("badgeFacts", () => {
  it("reads the cumulative counters and ignores missing rows", () => {
    expect(
      badgeFacts({
        profile: { bestStreak: 7, completedSessions: 12 },
        metrics: [
          { name: "word.learned", value: 25 },
          { name: "word.mastered", value: 4 },
          { name: "monthlyReview.completed", value: 2 },
          { name: "xp.earned", value: 900 },
        ],
        exams: [],
      }),
    ).toEqual({
      wordsLearned: 25,
      wordsMastered: 4,
      bestStreak: 7,
      completedSessions: 12,
      monthlyReviews: 2,
      completedTopicIds: [],
    })

    expect(
      badgeFacts({
        profile: { bestStreak: 0, completedSessions: 0 },
        metrics: [],
        exams: [],
      }),
    ).toEqual(EMPTY)
  })

  it("counts only completed topics and never duplicates one", () => {
    expect(
      badgeFacts({
        profile: { bestStreak: 0, completedSessions: 0 },
        metrics: [],
        exams: [
          { topicId: "t1", completedAt: 1_000 },
          { topicId: "t2", completedAt: null },
          { topicId: "t1", completedAt: 2_000 },
        ],
      }).completedTopicIds,
    ).toEqual(["t1"])
  })
})

describe("facts after a result", () => {
  it("applies a session's metric deltas and profile patch", () => {
    expect(
      factsAfterSession(facts({ wordsLearned: 20 }), {
        metrics: {
          "word.learned": 10,
          "word.mastered": 2,
          "monthlyReview.completed": 1,
        },
        profile: { bestStreak: 5, completedSessions: 21 },
      } as Pick<SessionCommitPayload, "metrics" | "profile">),
    ).toEqual({
      wordsLearned: 30,
      wordsMastered: 2,
      bestStreak: 5,
      completedSessions: 21,
      monthlyReviews: 1,
      completedTopicIds: [],
    })
  })

  it("leaves counters alone when the commit has no delta", () => {
    expect(
      factsAfterSession(facts({ wordsLearned: 20, wordsMastered: 3 }), {
        metrics: { "session.completed": 1 },
        profile: { bestStreak: 2, completedSessions: 4 },
      } as Pick<SessionCommitPayload, "metrics" | "profile">),
    ).toEqual({
      wordsLearned: 20,
      wordsMastered: 3,
      bestStreak: 2,
      completedSessions: 4,
      monthlyReviews: 0,
      completedTopicIds: [],
    })
  })

  it("adds a topic completed by an exam and nothing else", () => {
    const before = facts({ wordsLearned: 30, completedTopicIds: ["t1"] })

    expect(factsAfterExamCompletion(before, "t2", 1_000)).toEqual({
      ...before,
      completedTopicIds: ["t1", "t2"],
    })
    expect(factsAfterExamCompletion(before, "t1", 1_000)).toEqual(before)
    expect(factsAfterExamCompletion(before, "t2", null)).toEqual(before)
  })
})
