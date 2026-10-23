import { describe, expect, it } from "vitest"

import {
  answerAttempt,
  availableModes,
  buildSession,
  buildSessionResult,
  confirmRevealAnswer,
  createSessionState,
  estimatedMinutes,
  exerciseSeed,
  hasIntro,
  isLastExercise,
  localDateKey,
  previewSession,
  screenCount,
  sessionReducer,
  sessionSeed,
  sessionSeedKey,
  type BuildSessionInput,
  type SessionPlan,
  type SessionSeed,
  type SessionState,
} from "./session"
import type {
  Pack,
  Progress,
  SessionWordResult,
  Word,
  WordLevel,
} from "./types"

const NOW = 1_000_000
const DAY = 86_400_000

const SEED: SessionSeed = {
  profileId: 1,
  localDate: "2026-10-21",
  kind: "daily",
  contentVersion: "dev",
}

function makeWord(
  id: string,
  topicId = "t1",
  level: WordLevel = 1,
): Word {
  return {
    id,
    text: id,
    phonetic: `/${id}/`,
    partOfSpeech: "noun",
    meaningEn: `meaning of ${id}`,
    meaningZh: `${id} 的意思`,
    definitionEn: `definition of ${id}`,
    definitionZh: `${id} 的解释`,
    examples: [{ en: `I see a ${id}.`, zh: `我看见一个${id}。` }],
    image: `art/${id}.webp`,
    emoji: "🔤",
    level,
    tags: [],
    topicIds: [topicId],
  }
}

function makePack(
  id: string,
  wordIds: string[],
  order: number,
  mastery: 0 | 15 | 30,
  topicId = "t1",
): Pack {
  return {
    id,
    title: id,
    titleZh: id,
    topicId,
    wordIds,
    order,
    unlockRule: { type: "masteryCount", value: mastery },
  }
}

function mastered(wordId: string): Progress {
  return makeProgress(wordId, {
    status: "mastered",
    strength: 0.9,
    nextReviewAt: NOW + DAY,
  })
}

function makeProgress(
  wordId: string,
  overrides: Partial<Progress> = {},
): Progress {
  return {
    profileId: 1,
    wordId,
    status: "learning",
    strength: 0.2,
    nextReviewAt: NOW - DAY,
    correctCount: 1,
    wrongCount: 0,
    firstSeenAt: NOW - 2 * DAY,
    lastSeenAt: NOW - DAY,
    masteryXpAwarded: false,
    ...overrides,
  }
}

function makeInput(
  overrides: Partial<BuildSessionInput> = {},
): BuildSessionInput {
  return {
    profile: { id: 1, currentTopicId: "t1" },
    progress: [],
    packs: [],
    words: [],
    now: NOW,
    seed: SEED,
    speechAvailable: true,
    ...overrides,
  }
}

function planWith(
  packs: Pack[],
  words: Word[],
  progress: Progress[] = [],
  currentTopicId: string | null = "t1",
) {
  return buildSession(
    makeInput({
      profile: { id: 1, currentTopicId },
      packs,
      words,
      progress,
    }),
  )
}

function newWordsOf(plan: SessionPlan) {
  return plan.words.filter((word) => word.kind === "new")
}

function comprehensiveOf(plan: SessionPlan) {
  return plan.words.filter((word) => word.kind === "comprehensive")
}

function playAllCorrect(initial: SessionState): SessionState {
  let state = initial
  let guard = 0

  while (state.phase !== "complete") {
    guard += 1
    expect(guard).toBeLessThan(500)

    if (state.phase === "intro") {
      state = sessionReducer(state, { type: "continueIntro" })
      continue
    }

    if (state.phase === "exercise") {
      state = sessionReducer(state, { type: "answer", correct: true })
      continue
    }

    if (state.phase === "feedback") {
      state = sessionReducer(state, {
        type: "continueFeedback",
        now: NOW + guard,
      })
      continue
    }

    throw new Error(`unexpected phase ${state.phase}`)
  }

  return state
}

describe("localDateKey", () => {
  it("uses the local calendar day, not UTC", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe(
      "2026-01-05",
    )
    expect(localDateKey(new Date(2026, 9, 21, 0, 1).getTime())).toBe(
      "2026-10-21",
    )
  })
})

describe("sessionSeed", () => {
  it("pins the profile, local date, kind, and content version", () => {
    expect(sessionSeed(4, new Date(2026, 9, 21, 9).getTime(), "daily", "dev"))
      .toEqual({
        profileId: 4,
        localDate: "2026-10-21",
        kind: "daily",
        contentVersion: "dev",
      })
  })
})

describe("exerciseSeed", () => {
  it("pins one exercise to the session, word, and mode", () => {
    const key = sessionSeedKey(SEED)

    expect(key).toBe("1|2026-10-21|daily|dev")
    expect(exerciseSeed(SEED, "w-bag", "pictureMatch")).toBe(
      "1|2026-10-21|daily|dev|w-bag|pictureMatch",
    )
    expect(exerciseSeed(SEED, "w-bag", "spellingBuilder")).not.toBe(
      exerciseSeed(SEED, "w-bag", "pictureMatch"),
    )
  })
})

describe("buildSession", () => {
  it("selects five new words, each with spelling and one comprehensive exercise", () => {
    const words = Array.from({ length: 8 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )

    const plan = planWith(
      [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
    )

    expect(newWordsOf(plan)).toHaveLength(5)
    expect(comprehensiveOf(plan)).toHaveLength(5)
    expect(plan.words.filter((word) => word.kind === "review")).toHaveLength(0)
    expect(plan.caughtUp).toBe(false)

    const newIds = newWordsOf(plan).map((word) => word.wordId)

    expect(comprehensiveOf(plan).map((word) => word.wordId).sort()).toEqual(
      [...newIds].sort(),
    )
  })

  it("keeps due reviews out of the daily session", () => {
    const words = ["r1", "r2", "n1", "n2"].map((id) => makeWord(id))
    const progress = [
      makeProgress("r1", { nextReviewAt: NOW - DAY }),
      makeProgress("r2", { nextReviewAt: NOW - DAY }),
    ]

    const plan = planWith(
      [makePack("p1", ["n1", "n2"], 1, 0)],
      words,
      progress,
    )

    expect(plan.words.filter((word) => word.kind === "review")).toHaveLength(0)
    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual(["n1", "n2"])
  })

  it("is caught up when there are no new words, even with due reviews", () => {
    const words = ["due", "mastered"].map((id) => makeWord(id))
    const progress = [
      makeProgress("due", { nextReviewAt: NOW }),
      makeProgress("mastered", {
        status: "mastered",
        strength: 0.9,
        nextReviewAt: NOW - DAY,
      }),
    ]

    const plan = planWith([], words, progress)

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })

  it("reports caught up when nothing is due and nothing is new", () => {
    const plan = planWith([], [])

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })

  it("adds no new words when no topic has been chosen", () => {
    const word = makeWord("n1")
    const plan = planWith(
      [makePack("p1", ["n1"], 1, 0)],
      [word],
      [],
      null,
    )

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })

  it("keeps pack 2 locked below fifteen mastered words in the topic", () => {
    const first = ["a1", "a2", "a3"].map((id) => makeWord(id))
    const second = ["b1", "b2"].map((id) => makeWord(id))
    const progress = first.map((word) =>
      mastered(word.id),
    )

    const plan = planWith(
      [
        makePack("p1", first.map((word) => word.id), 1, 0),
        makePack("p2", second.map((word) => word.id), 2, 15),
      ],
      [...first, ...second],
      progress,
    )

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })

  it("opens pack 2 at fifteen mastered words and takes its unlearned words", () => {
    const first = Array.from({ length: 15 }, (_, index) =>
      makeWord(`a${index + 1}`),
    )
    const second = ["b1", "b2", "b3"].map((id) => makeWord(id))
    const progress = first.map((word) =>
      mastered(word.id),
    )

    const plan = planWith(
      [
        makePack("p1", first.map((word) => word.id), 1, 0),
        makePack("p2", second.map((word) => word.id), 2, 15),
      ],
      [...first, ...second],
      progress,
    )

    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual([
      "b1",
      "b2",
      "b3",
    ])
  })

  it("keeps pack 3 locked at twenty-nine and opens it at thirty", () => {
    const first = Array.from({ length: 20 }, (_, index) =>
      makeWord(`a${index + 1}`),
    )
    const second = Array.from({ length: 9 }, (_, index) =>
      makeWord(`b${index + 1}`),
    )
    const third = ["c1", "c2"].map((id) => makeWord(id))
    const extra = makeWord("extra")
    const packs = [
      makePack("p1", first.map((word) => word.id), 1, 0),
      makePack("p2", second.map((word) => word.id), 2, 15),
      makePack("p3", third.map((word) => word.id), 3, 30),
    ]
    const learned = [...first, ...second].map((word) =>
      mastered(word.id),
    )

    // Every word in packs 1 and 2 is learned; the count is 29, so pack 3 stays
    // locked and there is nowhere else new to come from.
    const locked = planWith(
      packs,
      [...first, ...second, extra, ...third],
      learned,
    )

    expect(locked.words).toEqual([])

    // A mastered word outside the packs is still mastery in this topic.
    const opened = planWith(
      packs,
      [...first, ...second, extra, ...third],
      [
        ...learned,
        mastered("extra"),
      ],
    )

    expect(newWordsOf(opened).map((word) => word.wordId)).toEqual(["c1", "c2"])
  })

  it("never selects from a locked pack when the open pack has no new words", () => {
    const first = ["a1", "a2", "a3"].map((id) => makeWord(id))
    const second = ["b1", "b2"].map((id) => makeWord(id))
    const progress = first.map((word) =>
      makeProgress(word.id, {
        status: "learning",
        strength: 0.4,
        nextReviewAt: NOW + DAY,
      }),
    )

    const plan = planWith(
      [
        makePack("p1", first.map((word) => word.id), 1, 0),
        makePack("p2", second.map((word) => word.id), 2, 15),
      ],
      [...first, ...second],
      progress,
    )

    expect(plan.words).toEqual([])
  })

  it("treats a word with any progress row as learned, including status new", () => {
    const words = ["n1", "n2", "n3"].map((id) => makeWord(id))
    const progress = [
      makeProgress("n1", { status: "new", nextReviewAt: NOW + DAY }),
    ]

    const plan = planWith(
      [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
      progress,
    )

    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual(["n2", "n3"])
  })

  it("dedupes a word repeated in a pack", () => {
    const words = ["d1", "d2", "d3", "d4", "d5"].map((id) => makeWord(id))

    const plan = planWith(
      [makePack("p1", ["d1", "d1", "d2", "d3", "d4", "d5"], 1, 0)],
      words,
    )

    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
    ])
  })

  it("prefers the lowest unlocked pack with an unlearned word", () => {
    const first = ["a1", "a2"].map((id) => makeWord(id))
    const second = ["b1"].map((id) => makeWord(id))
    const masteredWords = Array.from({ length: 15 }, (_, index) =>
      makeWord(`m${index + 1}`),
    )
    const progress = masteredWords.map((word) => mastered(word.id))

    const plan = planWith(
      [
        makePack("p1", first.map((word) => word.id), 1, 0),
        makePack("p2", second.map((word) => word.id), 2, 15),
      ],
      [...first, ...second, ...masteredWords],
      progress,
    )

    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual(["a1", "a2"])
  })

  it("counts mastery across the topic, not just one pack", () => {
    const first = Array.from({ length: 20 }, (_, index) =>
      makeWord(`a${index + 1}`),
    )
    const second = Array.from({ length: 10 }, (_, index) =>
      makeWord(`b${index + 1}`),
    )
    const next = ["c1"].map((id) => makeWord(id))
    const progress = [...first, ...second].map((word) =>
      mastered(word.id),
    )

    const plan = planWith(
      [
        makePack("p1", first.map((word) => word.id), 1, 0),
        makePack("p2", second.map((word) => word.id), 2, 15),
        makePack("p3", next.map((word) => word.id), 3, 30),
      ],
      [...first, ...second, ...next],
      progress,
    )

    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual(["c1"])
  })

  it("stays on the same five words while the day's session is unfinished", () => {
    const words = Array.from({ length: 10 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const input = makeInput({
      packs: [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
    })

    const first = buildSession(input)
    const reopened = buildSession(input)

    expect(newWordsOf(first).map((word) => word.wordId)).toEqual([
      "n1",
      "n2",
      "n3",
      "n4",
      "n5",
    ])
    expect(reopened).toEqual(first)
  })

  it("is caught up for the rest of the day once five new words were learned", () => {
    const words = Array.from({ length: 10 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const learnedToday = words.slice(0, 5).map((word) =>
      makeProgress(word.id, {
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        nextReviewAt: NOW + DAY,
      }),
    )
    const today = makeInput({
      packs: [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
      progress: learnedToday,
    })

    const plan = buildSession(today)

    expect(plan.words).toEqual([])
    expect(plan.caughtUp).toBe(true)
  })

  it("offers the next five words on the following local day", () => {
    const words = Array.from({ length: 10 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const learnedToday = words.slice(0, 5).map((word) =>
      makeProgress(word.id, {
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        nextReviewAt: NOW + DAY,
      }),
    )
    const tomorrow = makeInput({
      packs: [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
      progress: learnedToday,
      now: NOW + DAY,
      seed: { ...SEED, localDate: localDateKey(NOW + DAY) },
    })

    const plan = buildSession(tomorrow)

    expect(newWordsOf(plan).map((word) => word.wordId)).toEqual([
      "n6",
      "n7",
      "n8",
      "n9",
      "n10",
    ])
    expect(plan.caughtUp).toBe(false)
  })
})

describe("previewSession", () => {
  it("reports the same counts as the full builder", () => {
    const words = ["r1", "n1", "n2"].map((id) => makeWord(id))
    const input = makeInput({
      words,
      packs: [makePack("p1", ["n1", "n2"], 1, 0)],
      progress: [makeProgress("r1", { nextReviewAt: NOW - DAY })],
    })

    const plan = buildSession(input)
    const preview = previewSession(input)

    expect(preview).toEqual({
      reviewCount: 0,
      newCount: newWordsOf(plan).length,
      caughtUp: plan.caughtUp,
    })
  })
})

describe("mode assignment", () => {
  it("is deterministic for the same seed", () => {
    const words = ["r1", "n1"].map((id) => makeWord(id))
    const input = makeInput({
      words,
      packs: [makePack("p1", ["n1"], 1, 0)],
      progress: [makeProgress("r1")],
    })

    expect(buildSession(input)).toEqual(buildSession(input))
  })

  it("practises each new word by spelling, then one non-spelling mode", () => {
    const words = ["n1", "n2"].map((id) => makeWord(id))
    const plan = planWith(
      [makePack("p1", ["n1", "n2"], 1, 0)],
      words,
    )

    for (const word of newWordsOf(plan)) {
      expect(word.modes).toEqual(["spellingBuilder"])
    }

    for (const word of comprehensiveOf(plan)) {
      expect(word.modes).toHaveLength(1)
      expect(word.modes).not.toContain("spellingBuilder")
    }
  })

  it("shuffles the comprehensive block without losing or repeating a word", () => {
    const words = Array.from({ length: 5 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const plan = planWith(
      [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
    )
    const comprehensive = comprehensiveOf(plan)

    expect(comprehensive).toHaveLength(5)
    expect(new Set(comprehensive.map((word) => word.wordId)).size).toBe(5)
    expect(comprehensive.map((word) => word.wordId).sort()).toEqual([
      "n1",
      "n2",
      "n3",
      "n4",
      "n5",
    ])
  })

  it("excludes listen and choose from every mode when no English voice exists", () => {
    const words = ["n1", "n2"].map((id) => makeWord(id))
    const input = makeInput({
      words,
      packs: [makePack("p1", ["n1", "n2"], 1, 0)],
      speechAvailable: false,
    })
    const plan = buildSession(input)
    const modes = plan.words.flatMap((word) => word.modes)

    expect(modes).not.toContain("listenChoose")
    expect(newWordsOf(plan).every((word) => word.modes.length === 1)).toBe(true)
    expect(
      comprehensiveOf(plan).every(
        (word) =>
          word.modes.length === 1 &&
          word.modes[0] !== "spellingBuilder" &&
          word.modes[0] !== "listenChoose",
      ),
    ).toBe(true)
  })

  it("offers listen and choose only when speech is available", () => {
    expect(availableModes(true)).toContain("listenChoose")
    expect(availableModes(false)).not.toContain("listenChoose")
    expect(availableModes(false)).toHaveLength(4)
  })
})

describe("estimatedMinutes", () => {
  function planOfScreens(screens: number): SessionPlan {
    return {
      words: Array.from({ length: screens }, (_, index) => ({
        wordId: `w${index}`,
        kind: "review" as const,
        modes: ["fillBlank" as const],
      })),
      caughtUp: screens === 0,
    }
  }

  it("rounds the screen count up to the next five minutes", () => {
    expect(estimatedMinutes(planOfScreens(15))).toBe(10)
    expect(estimatedMinutes(planOfScreens(17))).toBe(10)
    expect(estimatedMinutes(planOfScreens(55))).toBe(25)
    expect(estimatedMinutes(planOfScreens(65))).toBe(30)
    expect(estimatedMinutes(planOfScreens(0))).toBe(5)
  })
})

describe("attempt feedback ladder", () => {
  it("awards two XP for a first-try correct answer", () => {
    const result = answerAttempt(
      {
        wrongTaps: 0,
        hintLevel: 0,
        revealed: false,
        solved: false,
        xp: 0,
        firstTry: false,
      },
      true,
    )

    expect(result.feedback).toBe("correct")
    expect(result.state).toMatchObject({
      solved: true,
      firstTry: true,
      xp: 2,
      hintLevel: 0,
      wrongTaps: 0,
    })
  })

  it("escalates a first and second miss into hints", () => {
    let state = answerAttempt(
      {
        wrongTaps: 0,
        hintLevel: 0,
        revealed: false,
        solved: false,
        xp: 0,
        firstTry: false,
      },
      false,
    )

    expect(state.feedback).toBe("hint")
    expect(state.state).toMatchObject({
      wrongTaps: 1,
      hintLevel: 1,
      revealed: false,
      xp: 0,
    })

    state = answerAttempt(state.state, false)

    expect(state.feedback).toBe("hint")
    expect(state.state).toMatchObject({
      wrongTaps: 2,
      hintLevel: 2,
      revealed: false,
      xp: 0,
    })
  })

  it("reveals after a third miss and awards no XP", () => {
    let state = answerAttempt(
      {
        wrongTaps: 0,
        hintLevel: 0,
        revealed: false,
        solved: false,
        xp: 0,
        firstTry: false,
      },
      false,
    )
    state = answerAttempt(state.state, false)
    state = answerAttempt(state.state, false)

    expect(state.feedback).toBe("reveal")
    expect(state.state).toMatchObject({
      wrongTaps: 3,
      hintLevel: 2,
      revealed: true,
      xp: 0,
    })

    const confirmed = confirmRevealAnswer(state.state)

    expect(confirmed).toMatchObject({
      revealed: true,
      solved: true,
      xp: 0,
      firstTry: false,
    })
  })

  it("awards one XP after a hint or a miss", () => {
    let state = answerAttempt(
      {
        wrongTaps: 0,
        hintLevel: 0,
        revealed: false,
        solved: false,
        xp: 0,
        firstTry: false,
      },
      false,
    )
    state = answerAttempt(state.state, true)

    expect(state.feedback).toBe("correct")
    expect(state.state).toMatchObject({
      solved: true,
      firstTry: false,
      xp: 1,
      hintLevel: 1,
    })
  })

  it("ignores a correct answer after the answer has been revealed", () => {
    const revealed = {
      wrongTaps: 3,
      hintLevel: 2 as const,
      revealed: true,
      solved: false,
      xp: 0,
      firstTry: false,
    }

    expect(answerAttempt(revealed, true).state).toEqual(revealed)
  })
})

function oneWordPlan(kind: "review" | "new"): SessionState {
  if (kind === "review") {
    return createSessionState(
      {
        words: [{ wordId: "r1", kind: "review", modes: ["fillBlank"] }],
        caughtUp: false,
      },
      SEED,
    )
  }

  const plan = planWith(
    [makePack("p1", ["n1"], 1, 0)],
    [makeWord("n1")],
  )

  return createSessionState(plan, SEED)
}

describe("session reducer", () => {
  it("starts a review straight at the exercise and a new word at the intro", () => {
    const review = sessionReducer(oneWordPlan("review"), {
      type: "start",
      now: NOW,
    })
    const fresh = sessionReducer(oneWordPlan("new"), {
      type: "start",
      now: NOW,
    })

    expect(review.phase).toBe("exercise")
    expect(fresh.phase).toBe("intro")
    expect(hasIntro(fresh)).toBe(true)
  })

  it("runs five new words and their comprehensive block to completion", () => {
    const newWords = Array.from({ length: 5 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const plan = planWith(
      [makePack("p1", newWords.map((word) => word.id), 1, 0)],
      newWords,
    )

    const started = sessionReducer(createSessionState(plan, SEED), {
      type: "start",
      now: NOW,
    })
    const finished = playAllCorrect(started)

    expect(screenCount(plan)).toBe(15)
    expect(finished.phase).toBe("complete")
    expect(finished.startedAt).toBe(NOW)
    expect(finished.completedAt).not.toBeNull()

    const result = buildSessionResult(finished)

    expect(result).not.toBeNull()
    expect(result?.words).toHaveLength(5)
    expect(result?.words.reduce((sum, word) => sum + word.attempts.length, 0)).toBe(
      10,
    )
    expect(result?.xpEarned).toBe(20)
    expect(result?.kind).toBe("daily")
    expect(result?.words.every((word) => word.firstAttemptCorrect)).toBe(true)
  })

  it("records a revealed attempt and moves on after confirmation", () => {
    let state = sessionReducer(oneWordPlan("new"), {
      type: "start",
      now: NOW,
    })
    state = sessionReducer(state, { type: "continueIntro" })

    for (let attempt = 0; attempt < 3; attempt += 1) {
      state = sessionReducer(state, { type: "answer", correct: false })
      if (state.phase === "feedback" && state.feedback === "reveal") {
        break
      }
      state = sessionReducer(state, {
        type: "continueFeedback",
        now: NOW + attempt + 1,
      })
    }

    expect(state.phase).toBe("feedback")
    expect(state.feedback).toBe("reveal")

    state = sessionReducer(state, {
      type: "confirmReveal",
      now: NOW + 10,
    })

    expect(state.attempts).toHaveLength(1)
    expect(state.attempts[0]).toMatchObject({
      wordId: "n1",
      correct: false,
      revealed: true,
      wrongTaps: 3,
      hintLevel: 2,
      xp: 0,
    })
    expect(state.phase).toBe("exercise")
    expect(state.wordIndex).toBe(1)
    expect(state.exerciseIndex).toBe(0)
  })

  it("keeps hints while the child tries the same exercise again", () => {
    let state = sessionReducer(oneWordPlan("review"), {
      type: "start",
      now: NOW,
    })
    state = sessionReducer(state, { type: "answer", correct: false })
    state = sessionReducer(state, {
      type: "continueFeedback",
      now: NOW + 1,
    })

    expect(state.phase).toBe("exercise")
    expect(state.attempt.hintLevel).toBe(1)
    expect(state.attempt.wrongTaps).toBe(1)

    state = sessionReducer(state, { type: "answer", correct: true })

    expect(state.feedback).toBe("correct")
    expect(state.attempt.xp).toBe(1)
  })

  it("marks the last exercise so the host can say Finish", () => {
    let state = sessionReducer(oneWordPlan("review"), {
      type: "start",
      now: NOW,
    })

    expect(isLastExercise(state)).toBe(true)

    state = sessionReducer(state, { type: "answer", correct: true })

    expect(isLastExercise(state)).toBe(true)
  })

  it("builds one result row per word, aggregating spelling and comprehensive attempts", () => {
    let state = sessionReducer(oneWordPlan("new"), {
      type: "start",
      now: NOW,
    })
    state = sessionReducer(state, { type: "continueIntro" })
    // Spelling: one miss then a correct answer.
    state = sessionReducer(state, { type: "answer", correct: false })
    state = sessionReducer(state, {
      type: "continueFeedback",
      now: NOW + 1,
    })
    state = sessionReducer(state, { type: "answer", correct: true })
    state = sessionReducer(state, {
      type: "continueFeedback",
      now: NOW + 2,
    })
    // Comprehensive: first-try correct.
    state = sessionReducer(state, { type: "answer", correct: true })
    state = sessionReducer(state, {
      type: "continueFeedback",
      now: NOW + 3,
    })

    const result = buildSessionResult(state)
    const row = result?.words[0] as SessionWordResult

    expect(result?.words).toHaveLength(1)
    expect(row.firstAttemptCorrect).toBe(false)
    expect(row.attempts).toHaveLength(2)
    expect(result?.xpEarned).toBe(3)
  })

  it("discards everything when the child confirms leaving", () => {
    let state = sessionReducer(oneWordPlan("new"), {
      type: "start",
      now: NOW,
    })
    state = sessionReducer(state, { type: "continueIntro" })
    state = sessionReducer(state, { type: "answer", correct: false })

    const discarded = sessionReducer(state, { type: "abandon" })

    expect(discarded.phase).toBe("idle")
    expect(discarded.attempts).toEqual([])
    expect(discarded.feedback).toBeNull()
    expect(buildSessionResult(discarded)).toBeNull()
  })

  it("ignores answers before the session starts and after it completes", () => {
    const idle = oneWordPlan("review")
    const unanswered = sessionReducer(idle, { type: "answer", correct: true })

    expect(unanswered).toEqual(idle)

    const completed = playAllCorrect(
      sessionReducer(oneWordPlan("review"), { type: "start", now: NOW }),
    )
    const late = sessionReducer(completed, {
      type: "answer",
      correct: true,
    })

    expect(late).toEqual(completed)
  })
})
