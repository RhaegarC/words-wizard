import { config } from "./config"

import { createRng, hashString, shuffle } from "./random"
import { localDateKey } from "./time"
import {
  PRACTICE_MODES,
  type Pack,
  type PracticeMode,
  type Profile,
  type Progress,
  type SessionAttempt,
  type SessionKind,
  type SessionResult,
  type SessionWordResult,
  type Word,
} from "./types"

/**
 * The daily session: a pure builder plus a pure reducer.
 *
 * Nothing in this module reads IndexedDB or touches React. The screens render
 * the reducer's state and hand answers back; feature 09 turns the completed
 * `SessionResult` into one transaction.
 */

export type SessionWordKind =
  | "review"
  | "new"
  | "repeat"
  | "comprehensive"

export interface SessionWord {
  wordId: string
  kind: SessionWordKind
  /** The one mode this entry runs. */
  modes: PracticeMode[]
}

export interface SessionPlan {
  words: SessionWord[]
  caughtUp: boolean
}

export interface SessionPreview {
  reviewCount: number
  newCount: number
  /** Words already learned today, offered as extra practice. */
  repeatCount: number
  caughtUp: boolean
}

/** Deterministic inputs to mode assignment, per PRD §5.2. */
export interface SessionSeed {
  profileId: number
  /** Local calendar day, `YYYY-MM-DD`. */
  localDate: string
  kind: SessionKind
  contentVersion: string
}

export interface BuildSessionInput {
  profile: Pick<Profile, "id" | "currentTopicId">
  progress: readonly Progress[]
  packs: readonly Pack[]
  words: readonly Word[]
  now: number
  seed: SessionSeed
  speechAvailable: boolean
}

export type AttemptFeedback = "correct" | "hint" | "reveal"

export interface AttemptState {
  wrongTaps: number
  hintLevel: 0 | 1 | 2
  revealed: boolean
  solved: boolean
  xp: number
  firstTry: boolean
}

export const INITIAL_ATTEMPT: AttemptState = {
  wrongTaps: 0,
  hintLevel: 0,
  revealed: false,
  solved: false,
  xp: 0,
  firstTry: false,
}

export type SessionPhase = "idle" | "intro" | "exercise" | "feedback" | "complete"

export interface SessionState {
  phase: SessionPhase
  plan: SessionPlan
  seed: SessionSeed
  wordIndex: number
  exerciseIndex: number
  attempt: AttemptState
  attempts: SessionAttempt[]
  feedback: AttemptFeedback | null
  startedAt: number | null
  completedAt: number | null
}

export type SessionAction =
  | { type: "start"; now: number }
  | { type: "continueIntro" }
  | { type: "answer"; correct: boolean }
  | { type: "continueFeedback"; now: number }
  | { type: "confirmReveal"; now: number }
  | { type: "abandon" }

/** Kept here for the engine's existing imports; the rule lives in `time.ts`. */
export { localDateKey } from "./time"

export function sessionSeed(
  profileId: number,
  now: number,
  kind: SessionKind,
  contentVersion: string,
): SessionSeed {
  return {
    profileId,
    localDate: localDateKey(now),
    kind,
    contentVersion,
  }
}

/**
 * Every practice mode, with listen and choose dropped when no English voice
 * exists. The monthly review and the comprehensive block draw from this pool.
 */
export function availableModes(
  speechAvailable: boolean,
): readonly PracticeMode[] {
  return PRACTICE_MODES.filter(
    (mode) => speechAvailable || mode !== "listenChoose",
  )
}

/**
 * Five new words from the lowest-order unlocked pack in the selected topic.
 * Once today's set has been learned, the same five come back as extra
 * practice — without introduction cards — until the next local day. Each
 * entry is practised with its per-word mode, then the whole set gets one
 * comprehensive exercise per word in a shuffled order.
 */
export function buildSession(input: BuildSessionInput): SessionPlan {
  const entries = selectEntries(input)
  const words = assignNewWordModes(entries, input.speechAvailable)
  const comprehensive = assignComprehensive(
    entries,
    input.seed,
    input.speechAvailable,
  )

  return {
    words: [...words, ...comprehensive],
    caughtUp: entries.length === 0,
  }
}

/**
 * Assign one rotating mode per prepared entry. The monthly review uses this
 * with a single review entry per word, so its selection stays deterministic.
 */
export function assignSessionWords(
  entries: readonly { wordId: string; kind: SessionWordKind }[],
  _seed: SessionSeed,
  speechAvailable: boolean,
): SessionWord[] {
  return assignModes(entries, availableModes(speechAvailable))
}

/** Counts for Home and the session landing, without assigning modes. */
export function previewSession(input: BuildSessionInput): SessionPreview {
  const entries = selectEntries(input)

  return {
    reviewCount: entries.filter((entry) => entry.kind === "review").length,
    newCount: entries.filter((entry) => entry.kind === "new").length,
    repeatCount: entries.filter((entry) => entry.kind === "repeat").length,
    caughtUp: entries.length === 0,
  }
}

/** 5 × (intro + spelling) + 5 comprehensive = 15. */
export function screenCount(plan: SessionPlan): number {
  return plan.words.reduce(
    (total, word) =>
      total + (word.kind === "new" ? 1 : 0) + word.modes.length,
    0,
  )
}

/** A rough duration for the landing screen, rounded up to five minutes. */
export function estimatedMinutes(plan: SessionPlan): number {
  const seconds = screenCount(plan) * config.session.secondsPerScreen

  return Math.max(5, Math.ceil(seconds / 60 / 5) * 5)
}

export function answerAttempt(
  state: AttemptState,
  correct: boolean,
): { state: AttemptState; feedback: AttemptFeedback } {
  // The answer is already on screen; only the confirming tap may complete it.
  if (state.revealed) {
    return { state, feedback: "reveal" }
  }

  if (state.solved) {
    return { state, feedback: "correct" }
  }

  if (!correct) {
    const wrongTaps = state.wrongTaps + 1

    if (wrongTaps >= 3) {
      return {
        state: {
          ...state,
          wrongTaps,
          hintLevel: 2,
          revealed: true,
          xp: 0,
        },
        feedback: "reveal",
      }
    }

    return {
      state: {
        ...state,
        wrongTaps,
        hintLevel: wrongTaps === 1 ? 1 : 2,
      },
      feedback: "hint",
    }
  }

  const firstTry = state.wrongTaps === 0 && state.hintLevel === 0

  return {
    state: {
      ...state,
      solved: true,
      firstTry,
      xp: firstTry ? config.xp.firstTry : config.xp.afterHint,
    },
    feedback: "correct",
  }
}

/** The third miss reveals the answer; a deliberate tap completes the attempt. */
export function confirmRevealAnswer(state: AttemptState): AttemptState {
  if (!state.revealed) {
    return state
  }

  return {
    ...state,
    solved: true,
    firstTry: false,
    xp: 0,
  }
}

export function toSessionAttempt(
  wordId: string,
  mode: PracticeMode,
  state: AttemptState,
): SessionAttempt {
  return {
    wordId,
    mode,
    correct: state.solved && !state.revealed,
    hintLevel: state.hintLevel,
    revealed: state.revealed,
    wrongTaps: state.wrongTaps,
    xp: state.xp,
  }
}

export function createSessionState(
  plan: SessionPlan,
  seed: SessionSeed,
): SessionState {
  return {
    phase: "idle",
    plan,
    seed,
    wordIndex: 0,
    exerciseIndex: 0,
    attempt: { ...INITIAL_ATTEMPT },
    attempts: [],
    feedback: null,
    startedAt: null,
    completedAt: null,
  }
}

export function hasIntro(state: SessionState): boolean {
  return state.plan.words[state.wordIndex]?.kind === "new"
}

export function isLastExercise(state: SessionState): boolean {
  const word = state.plan.words[state.wordIndex]
  const isLastWord = state.wordIndex >= state.plan.words.length - 1

  return (
    word !== undefined &&
    isLastWord &&
    state.exerciseIndex >= word.modes.length - 1
  )
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "start": {
      const first = state.plan.words[0]

      if (state.phase !== "idle" || first === undefined) {
        return state
      }

      return {
        ...state,
        phase: first.kind === "new" ? "intro" : "exercise",
        wordIndex: 0,
        exerciseIndex: 0,
        attempt: { ...INITIAL_ATTEMPT },
        attempts: [],
        feedback: null,
        startedAt: action.now,
        completedAt: null,
      }
    }

    case "continueIntro":
      return state.phase === "intro"
        ? {
            ...state,
            phase: "exercise",
            attempt: { ...INITIAL_ATTEMPT },
            feedback: null,
          }
        : state

    case "answer": {
      if (state.phase !== "exercise") {
        return state
      }

      const result = answerAttempt(state.attempt, action.correct)

      return {
        ...state,
        phase: "feedback",
        attempt: result.state,
        feedback: result.feedback,
      }
    }

    case "continueFeedback": {
      if (state.phase !== "feedback" || state.feedback === null) {
        return state
      }

      // A hint is "try the same exercise again"; the attempt keeps its state.
      if (state.feedback === "hint") {
        return { ...state, phase: "exercise", feedback: null }
      }

      // The reveal is completed only by the confirming tap.
      if (state.feedback === "reveal") {
        return state
      }

      return advance(state, action.now)
    }

    case "confirmReveal": {
      if (
        state.phase !== "feedback" ||
        state.feedback !== "reveal" ||
        !state.attempt.revealed
      ) {
        return state
      }

      return advance(
        { ...state, attempt: confirmRevealAnswer(state.attempt) },
        action.now,
      )
    }

    case "abandon":
      return createSessionState({ words: [], caughtUp: true }, state.seed)
  }
}

/**
 * One completion row per distinct word, in first-appearance order. A word met
 * in the learning block and again in the comprehensive block contributes both
 * attempts to the same row, so the commit applies its scheduler delta once.
 */
export function buildSessionResult(state: SessionState): SessionResult | null {
  if (
    state.phase !== "complete" ||
    state.startedAt === null ||
    state.completedAt === null
  ) {
    return null
  }

  const seen = new Set<string>()
  const words: SessionWordResult[] = []

  for (const planned of state.plan.words) {
    if (seen.has(planned.wordId)) {
      continue
    }

    seen.add(planned.wordId)

    const attempts = state.attempts.filter(
      (attempt) => attempt.wordId === planned.wordId,
    )
    const first = attempts[0]

    words.push({
      wordId: planned.wordId,
      firstAttemptCorrect:
        first !== undefined &&
        first.correct &&
        first.wrongTaps === 0 &&
        first.hintLevel === 0,
      attempts,
    })
  }

  return {
    id: `${state.seed.profileId}:${state.seed.kind}:${state.seed.localDate}:${state.startedAt}`,
    kind: state.seed.kind,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    words,
    xpEarned: state.attempts.reduce(
      (total, attempt) => total + attempt.xp,
      0,
    ),
  }
}

interface SessionEntry {
  wordId: string
  kind: SessionWordKind
}

function selectEntries(input: BuildSessionInput): SessionEntry[] {
  const profileId = input.profile.id
  const progress =
    profileId === undefined
      ? []
      : input.progress.filter((row) => row.profileId === profileId)
  const progressByWord = new Map(
    progress.map((row) => [row.wordId, row] as const),
  )

  // A committed daily session stamps `firstSeenAt` on each new word. Once any
  // word was learned today, no new set is selected until the next local day;
  // the words learned today come back as extra practice instead.
  const today = localDateKey(input.now)
  const learnedToday = progress.some(
    (row) => localDateKey(row.firstSeenAt) === today,
  )

  if (learnedToday) {
    return selectRepeatIds(input, progressByWord)
      .slice(0, config.session.newWords)
      .map((wordId): SessionEntry => ({ wordId, kind: "repeat" }))
  }

  return selectNewWordIds(input, progressByWord)
    .slice(0, config.session.newWords)
    .map((wordId): SessionEntry => ({ wordId, kind: "new" }))
}

/** Today's learned words, in the same pack order that selected them. */
function selectRepeatIds(
  input: BuildSessionInput,
  progressByWord: ReadonlyMap<string, Progress>,
): string[] {
  const today = localDateKey(input.now)
  const wordsById = new Map(input.words.map((word) => [word.id, word]))

  for (const pack of unlockedPacks(input, progressByWord)) {
    const learnedToday = [
      ...new Set(
        pack.wordIds.filter((wordId) => {
          const row = progressByWord.get(wordId)

          return (
            wordsById.has(wordId) &&
            row !== undefined &&
            localDateKey(row.firstSeenAt) === today
          )
        }),
      ),
    ]

    if (learnedToday.length > 0) {
      return learnedToday
    }
  }

  return []
}

function selectNewWordIds(
  input: BuildSessionInput,
  progressByWord: ReadonlyMap<string, Progress>,
): string[] {
  const wordsById = new Map(input.words.map((word) => [word.id, word]))

  for (const pack of unlockedPacks(input, progressByWord)) {
    const unlearned = [
      ...new Set(
        pack.wordIds.filter(
          (wordId) =>
            wordsById.has(wordId) && !progressByWord.has(wordId),
        ),
      ),
    ]

    if (unlearned.length > 0) {
      return unlearned
    }
  }

  return []
}

/**
 * The selected topic's unlocked packs, in order. The first pack is always
 * open; each later pack opens once every word of the pack before it has been
 * introduced to this user.
 *
 * Feature 22 has no introduction rows yet, so "introduced" is derived from
 * the word having a progress row at all — that row only exists after a
 * committed session, which is what stamped `firstSeenAt`. Feature 24 replaces
 * this derivation with the real per-pack introductions from `/v1/me`.
 */
function unlockedPacks(
  input: BuildSessionInput,
  progressByWord: ReadonlyMap<string, Progress>,
): Pack[] {
  const topicId = input.profile.currentTopicId

  if (topicId === null) {
    return []
  }

  const ordered = input.packs
    .filter((pack) => pack.topicId === topicId)
    .sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    )

  const unlocked: Pack[] = []

  for (const pack of ordered) {
    const previous = unlocked[unlocked.length - 1]

    if (
      previous !== undefined &&
      !previous.wordIds.every((wordId) => progressByWord.has(wordId))
    ) {
      break
    }

    unlocked.push(pack)
  }

  return unlocked
}

function assignNewWordModes(
  entries: readonly SessionEntry[],
  speechAvailable: boolean,
): SessionWord[] {
  const perWord: readonly PracticeMode[] = config.session.newWordModes
  const modes = perWord.filter(
    (mode) => speechAvailable || mode !== "listenChoose",
  )

  return entries.map((entry) => ({ ...entry, modes: [...modes] }))
}

/**
 * One random mode per new word, then a fresh shuffle of the block. The pool is
 * every available mode except the per-word modes (currently spelling), so a
 * comprehensive exercise never repeats the exercise the child has just done.
 */
function assignComprehensive(
  entries: readonly SessionEntry[],
  seed: SessionSeed,
  speechAvailable: boolean,
): SessionWord[] {
  const perWord = new Set<PracticeMode>(config.session.newWordModes)
  const pool = availableModes(speechAvailable).filter(
    (mode) => !perWord.has(mode),
  )

  if (entries.length === 0 || pool.length === 0) {
    return []
  }

  const rng = createRng(hashString(`${sessionSeedKey(seed)}|comprehensive`))
  const picked = entries.map((entry): SessionWord => {
    const mode = pool[Math.floor(rng() * pool.length)]

    return { wordId: entry.wordId, kind: "comprehensive", modes: [mode] }
  })

  return shuffle(picked, rng)
}

function assignModes(
  entries: readonly SessionEntry[],
  available: readonly PracticeMode[],
): SessionWord[] {
  if (available.length === 0) {
    return entries.map((entry) => ({ ...entry, modes: [] }))
  }

  // Start the review rotation so the last review lands on the final mode.
  // That keeps it clear of the spelling builder that opens the next new word.
  const reviewCount = entries.filter((entry) => entry.kind === "review").length
  const reviewStart =
    (available.length - (reviewCount % available.length)) % available.length
  let reviewIndex = 0

  return entries.map((entry) => {
    if (entry.kind === "new") {
      return { ...entry, modes: [...available] }
    }

    const mode = available[(reviewStart + reviewIndex) % available.length]
    reviewIndex += 1

    return { ...entry, modes: [mode] }
  })
}

function advance(state: SessionState, now: number): SessionState {
  const word = state.plan.words[state.wordIndex]
  const mode = word.modes[state.exerciseIndex]
  const attempts = [
    ...state.attempts,
    toSessionAttempt(word.wordId, mode, state.attempt),
  ]

  if (state.exerciseIndex + 1 < word.modes.length) {
    return {
      ...state,
      phase: "exercise",
      exerciseIndex: state.exerciseIndex + 1,
      attempt: { ...INITIAL_ATTEMPT },
      attempts,
      feedback: null,
    }
  }

  const nextIndex = state.wordIndex + 1
  const nextWord = state.plan.words[nextIndex]

  if (nextWord === undefined) {
    return {
      ...state,
      phase: "complete",
      attempt: { ...INITIAL_ATTEMPT },
      attempts,
      feedback: null,
      completedAt: now,
    }
  }

  return {
    ...state,
    phase: nextWord.kind === "new" ? "intro" : "exercise",
    wordIndex: nextIndex,
    exerciseIndex: 0,
    attempt: { ...INITIAL_ATTEMPT },
    attempts,
    feedback: null,
  }
}

/** The session's stable string form; also the base of every exercise seed. */
export function sessionSeedKey(seed: SessionSeed): string {
  return [seed.profileId, seed.localDate, seed.kind, seed.contentVersion].join(
    "|",
  )
}

/** One exercise's seed: the session, its word, and its mode. */
export function exerciseSeed(
  seed: SessionSeed,
  wordId: string,
  mode: PracticeMode,
): string {
  return `${sessionSeedKey(seed)}|${wordId}|${mode}`
}
