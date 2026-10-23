import { describe, expect, it } from "vitest"

import { config } from "../config"

import { deriveCharacterState } from "./character"
import { buildHomeView, type HomeContent } from "./home"
import { isMonthlyReviewDue } from "./monthlyReview"
import { stageProgress } from "./progression"
import { previewSession, sessionSeed, type BuildSessionInput } from "./session"
import type { Avatar } from "./content/types"
import type { Pack, Profile, Progress, Word } from "./types"

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime()
const DAY = 86_400_000
const TOPIC = "craft-and-build"
const CONTENT_VERSION = "dev"

function makeProfile(
  overrides: Partial<Profile> = {},
): Profile & { id: number } {
  return {
    id: 1,
    name: "Mia",
    characterName: "Luma",
    avatar: "luma",
    currentTopicId: TOPIC,
    xp: 45,
    createdAt: NOW - 120 * DAY,
    lastPracticeAt: NOW - DAY,
    lastWakeAt: null,
    frozenDays: 0,
    careTokens: 1,
    sessionsSinceLastToken: 2,
    completedSessions: 7,
    streakCount: 4,
    bestStreak: 6,
    lastStreakDate: "2026-10-20",
    lastMonthlyReviewAt: null,
    locale: "en",
    ...overrides,
  }
}

function makeWord(index: number): Word {
  return {
    id: `w-${index}`,
    text: `word${index}`,
    phonetic: "/wɜːd/",
    partOfSpeech: "noun",
    meaningEn: `meaning ${index}`,
    meaningZh: `意思 ${index}`,
    definitionEn: `definition ${index}`,
    definitionZh: `解释 ${index}`,
    examples: [{ en: `A word ${index}.`, zh: `一个单词 ${index}。` }],
    image: `word-${index}`,
    level: 1,
    tags: [],
    topicIds: [TOPIC],
  }
}

const WORDS = Array.from({ length: 10 }, (_, index) => makeWord(index))

const PACKS: Pack[] = [
  {
    id: "p-1",
    title: "Pack 1",
    titleZh: "单词包 1",
    topicId: TOPIC,
    wordIds: WORDS.map((word) => word.id),
    order: 1,
    unlockRule: { type: "masteryCount", value: 0 },
  },
]

const AVATAR: Avatar = {
  id: "luma",
  name: "Luma",
  nameZh: "露玛",
  color: "#7059dc",
  pale: "#eeeafd",
  stages: {
    egg: "luma-egg",
    hatchling: "luma-hatchling",
    juvenile: "luma-juvenile",
    adult: "luma-adult",
    legendary: "luma-legendary",
  },
}

const CONTENT: HomeContent = {
  packs: PACKS,
  words: WORDS,
  avatars: [AVATAR],
  contentVersion: CONTENT_VERSION,
}

function makeProgress(
  wordId: string,
  overrides: Partial<Progress> = {},
): Progress {
  return {
    id: undefined,
    profileId: 1,
    wordId,
    status: "learning",
    strength: 0.4,
    nextReviewAt: NOW + DAY,
    correctCount: 1,
    wrongCount: 0,
    firstSeenAt: NOW - DAY,
    lastSeenAt: NOW - DAY,
    masteryXpAwarded: false,
    ...overrides,
  }
}

function previewFor(
  profile: Profile,
  progress: readonly Progress[],
): ReturnType<typeof previewSession> {
  const input: BuildSessionInput = {
    profile,
    progress,
    packs: CONTENT.packs,
    words: CONTENT.words,
    now: NOW,
    seed: sessionSeed(profile.id ?? -1, NOW, "daily", CONTENT.contentVersion),
    speechAvailable: false,
  }

  return previewSession(input)
}

function build(profile: Profile, progress: readonly Progress[]) {
  return buildHomeView({
    profile,
    progress,
    content: CONTENT,
    now: NOW,
    config,
  })
}

describe("buildHomeView", () => {
  it("reports the same due and new counts as previewSession", () => {
    const due = Array.from({ length: 5 }, (_, index) =>
      makeProgress(`w-${index}`, { nextReviewAt: NOW - 1_000 - index }),
    )
    const profile = makeProfile()
    const expected = previewFor(profile, due)
    const view = build(profile, due)

    expect(view.reviewsDue).toBe(expected.reviewCount)
    expect(view.newWords).toBe(expected.newCount)
    expect(view.practiceAgain).toBe(expected.repeatCount)
    expect(view.caughtUp).toBe(expected.caughtUp)
    expect(view.reviewsDue).toBe(0)
    expect(view.newWords).toBe(config.session.newWords)
    expect(view.caughtUp).toBe(false)
  })

  it("offers the day's five words for extra practice once they were learned", () => {
    const learnedToday = WORDS.slice(0, config.session.newWords).map((word) =>
      makeProgress(word.id, {
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        nextReviewAt: NOW + DAY,
      }),
    )
    const view = build(makeProfile(), learnedToday)

    expect(view.newWords).toBe(0)
    expect(view.reviewsDue).toBe(0)
    expect(view.practiceAgain).toBe(config.session.newWords)
    expect(view.caughtUp).toBe(false)
  })

  it("is caught up when there is neither a review nor a new word", () => {
    const allLearned = WORDS.map((word) => makeProgress(word.id))
    const profile = makeProfile()
    const view = build(profile, allLearned)

    expect(view.reviewsDue).toBe(0)
    expect(view.newWords).toBe(0)
    expect(view.caughtUp).toBe(true)
  })

  it("asks for a topic when none is selected", () => {
    const view = build(makeProfile({ currentTopicId: null }), [])

    expect(view.needsTopic).toBe(true)
  })

  it("does not need a topic when one is selected", () => {
    expect(build(makeProfile(), []).needsTopic).toBe(false)
  })

  it("delegates the monthly review flag", () => {
    const learned = Array.from({ length: 5 }, (_, index) =>
      makeProgress(`w-${index}`, { firstSeenAt: NOW - 40 * DAY + index }),
    )
    const dueProfile = makeProfile({ lastMonthlyReviewAt: NOW - 30 * DAY })
    const notDueProfile = makeProfile({ lastMonthlyReviewAt: NOW - 10 * DAY })

    expect(build(dueProfile, learned).monthlyReviewDue).toBe(
      isMonthlyReviewDue(dueProfile, learned, NOW),
    )
    expect(build(dueProfile, learned).monthlyReviewDue).toBe(true)
    expect(build(notDueProfile, learned).monthlyReviewDue).toBe(false)
  })

  it("carries streak and Care Token counts straight from the profile", () => {
    const profile = makeProfile({ streakCount: 9, careTokens: 2 })
    const view = build(profile, [])

    expect(view.streakCount).toBe(9)
    expect(view.careTokens).toBe(2)
    expect(view.bestStreak).toBe(profile.bestStreak)
  })

  it("derives character and stage exactly as the character screen does", () => {
    const profile = makeProfile({ xp: 320, lastPracticeAt: NOW - 6 * DAY })
    const view = build(profile, [])

    expect(view.character).toEqual(deriveCharacterState(profile, NOW))
    expect(view.stage).toEqual(stageProgress(profile.xp))
  })

  it("resolves the avatar set the profile names", () => {
    expect(build(makeProfile({ avatar: "luma" }), []).avatar).toBe(AVATAR)
    expect(build(makeProfile({ avatar: "unknown" }), []).avatar).toBeUndefined()
  })

  it("shows a token hint only while a token is close", () => {
    const close = build(
      makeProfile({ careTokens: 0, sessionsSinceLastToken: 3 }),
      [],
    )
    const far = build(
      makeProfile({ careTokens: 0, sessionsSinceLastToken: 2 }),
      [],
    )
    const full = build(
      makeProfile({
        careTokens: config.careTokens.cap,
        sessionsSinceLastToken: 5,
      }),
      [],
    )

    expect(close.tokenProgress.showHint).toBe(true)
    expect(close.tokenProgress.sessionsToNextToken).toBe(2)
    expect(far.tokenProgress.showHint).toBe(false)
    expect(far.tokenProgress.sessionsToNextToken).toBe(3)
    expect(full.tokenProgress.showHint).toBe(false)
    expect(full.tokenProgress.sessionsToNextToken).toBeNull()
  })

  it("stays quiet at the cap even with a partial counter", () => {
    const view = build(
      makeProfile({
        careTokens: config.careTokens.cap,
        sessionsSinceLastToken: 4,
      }),
      [],
    )

    expect(view.tokenProgress.sessionsToNextToken).toBeNull()
    expect(view.tokenProgress.showHint).toBe(false)
  })
})
