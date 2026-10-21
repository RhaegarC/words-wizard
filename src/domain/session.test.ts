import { describe, expect, it } from "vitest"

import {
  answerAttempt,
  availableModes,
  buildSession,
  buildSessionResult,
  confirmRevealAnswer,
  createSessionState,
  hasIntro,
  isLastExercise,
  localDateKey,
  previewSession,
  screenCount,
  sessionReducer,
  sessionSeed,
  type BuildSessionInput,
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

function playAllCorrect(initial: SessionState): SessionState {
  let state = initial
  let guard = 0

  while (state.phase !== "complete") {
    guard += 1
    expect(guard).toBeLessThan(100)

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

describe("buildSession", () => {
  it("builds five reviews plus four new words, capped at nine", () => {
    const newWords = Array.from({ length: 20 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const reviewWords = Array.from({ length: 7 }, (_, index) =>
      makeWord(`r${index + 1}`),
    )
    const progress = reviewWords.map((word, index) =>
      makeProgress(word.id, { nextReviewAt: NOW - (index + 1) * 1000 }),
    )

    const plan = planWith(
      [makePack("p1", newWords.map((word) => word.id), 1, 0)],
      [...newWords, ...reviewWords],
      progress,
    )

    expect(plan.words).toHaveLength(9)
    expect(plan.words.filter((word) => word.kind === "review")).toHaveLength(5)
    expect(plan.words.filter((word) => word.kind === "new")).toHaveLength(4)
    expect(plan.caughtUp).toBe(false)
  })

  it("orders due reviews by nextReviewAt, then by word id", () => {
    const words = ["b", "a", "c", "d"].map((id) => makeWord(id))
    const progress = [
      makeProgress("b", { nextReviewAt: NOW - 10 }),
      makeProgress("a", { nextReviewAt: NOW - 10 }),
      makeProgress("c", { nextReviewAt: NOW - 20 }),
      makeProgress("d", { nextReviewAt: NOW - 5 }),
    ]

    const plan = planWith([], words, progress)

    expect(plan.words.map((word) => word.wordId)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ])
  })

  it("ignores reviews that are not due, are new, or have no content", () => {
    const words = ["due", "future", "fresh", "mastered"].map((id) =>
      makeWord(id),
    )
    const progress = [
      makeProgress("due", { nextReviewAt: NOW }),
      makeProgress("future", { nextReviewAt: NOW + 1 }),
      makeProgress("fresh", { status: "new", nextReviewAt: NOW - DAY }),
      makeProgress("mastered", {
        status: "mastered",
        strength: 0.9,
        nextReviewAt: NOW - DAY,
      }),
      makeProgress("missing", { nextReviewAt: NOW - DAY }),
    ]

    const plan = planWith([], words, progress)

    expect(plan.words.map((word) => word.wordId)).toEqual([
      "mastered",
      "due",
    ])
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

    expect(plan.words.map((word) => word.wordId)).toEqual(["b1", "b2", "b3"])
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

    expect(opened.words.map((word) => word.wordId)).toEqual(["c1", "c2"])
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

    expect(plan.words.map((word) => word.wordId)).toEqual(["n2", "n3"])
  })

  it("dedupes a word repeated in a pack", () => {
    const words = ["d1", "d2", "d3", "d4", "d5"].map((id) => makeWord(id))

    const plan = planWith(
      [makePack("p1", ["d1", "d1", "d2", "d3", "d4", "d5"], 1, 0)],
      words,
    )

    expect(plan.words.map((word) => word.wordId)).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
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

    expect(plan.words.map((word) => word.wordId)).toEqual(["a1", "a2"])
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

    expect(plan.words.map((word) => word.wordId)).toEqual(["c1"])
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
      reviewCount: plan.words.filter((word) => word.kind === "review").length,
      newCount: plan.words.filter((word) => word.kind === "new").length,
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

  it("gives two distinct modes to each new word and one to each review", () => {
    const words = ["r1", "r2", "n1", "n2"].map((id) => makeWord(id))
    const plan = planWith(
      [makePack("p1", ["n1", "n2"], 1, 0)],
      words,
      [makeProgress("r1"), makeProgress("r2")],
    )

    for (const word of plan.words) {
      if (word.kind === "new") {
        expect(word.modes).toHaveLength(2)
        expect(new Set(word.modes).size).toBe(2)
      } else {
        expect(word.modes).toHaveLength(1)
      }
    }
  })

  it("never repeats a mode back-to-back when an alternative exists", () => {
    const words = Array.from({ length: 9 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const plan = planWith(
      [makePack("p1", words.map((word) => word.id), 1, 0)],
      words,
    )
    const modes = plan.words.flatMap((word) => word.modes)

    for (let index = 1; index < modes.length; index += 1) {
      expect(modes[index]).not.toBe(modes[index - 1])
    }
  })

  it("excludes listen and choose when no English voice exists", () => {
    const words = ["r1", "n1"].map((id) => makeWord(id))
    const input = makeInput({
      words,
      packs: [makePack("p1", ["n1"], 1, 0)],
      progress: [makeProgress("r1")],
      speechAvailable: false,
    })
    const modes = buildSession(input).words.flatMap((word) => word.modes)

    expect(modes).not.toContain("listenChoose")
    expect(modes.length).toBeGreaterThan(0)
  })

  it("offers listen and choose only when speech is available", () => {
    expect(availableModes(true)).toContain("listenChoose")
    expect(availableModes(false)).not.toContain("listenChoose")
    expect(availableModes(false)).toHaveLength(4)
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
  const word = makeWord(kind === "new" ? "n1" : "r1")
  const plan = planWith(
    kind === "new" ? [makePack("p1", ["n1"], 1, 0)] : [],
    [word],
    kind === "review" ? [makeProgress("r1")] : [],
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

  it("runs a full session of five reviews and four new words to completion", () => {
    const reviewWords = Array.from({ length: 5 }, (_, index) =>
      makeWord(`r${index + 1}`),
    )
    const newWords = Array.from({ length: 4 }, (_, index) =>
      makeWord(`n${index + 1}`),
    )
    const plan = planWith(
      [makePack("p1", newWords.map((word) => word.id), 1, 0)],
      [...reviewWords, ...newWords],
      reviewWords.map((word) => makeProgress(word.id)),
    )

    const started = sessionReducer(createSessionState(plan, SEED), {
      type: "start",
      now: NOW,
    })
    const finished = playAllCorrect(started)

    expect(screenCount(plan)).toBe(17)
    expect(finished.phase).toBe("complete")
    expect(finished.startedAt).toBe(NOW)
    expect(finished.completedAt).not.toBeNull()

    const result = buildSessionResult(finished)

    expect(result).not.toBeNull()
    expect(result?.words).toHaveLength(9)
    expect(result?.words.reduce((sum, word) => sum + word.attempts.length, 0)).toBe(
      13,
    )
    expect(result?.xpEarned).toBe(26)
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
    expect(state.exerciseIndex).toBe(1)
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

  it("builds one result row per word with its first-attempt flag", () => {
    let state = sessionReducer(oneWordPlan("new"), {
      type: "start",
      now: NOW,
    })
    state = sessionReducer(state, { type: "continueIntro" })
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
    state = sessionReducer(state, { type: "answer", correct: true })
    state = sessionReducer(state, {
      type: "continueFeedback",
      now: NOW + 3,
    })

    const result = buildSessionResult(state)
    const row = result?.words[0] as SessionWordResult

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
