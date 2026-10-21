import { config } from "../config"
import { createRng, hashString, shuffle } from "../domain/random"
import type { Word } from "../domain/types"

import type { ExerciseOption, ModeContext } from "./types"

/**
 * Distractor and option generation, written once and reused by the choice
 * modes. Every decision comes from the exercise's seed, so the same session
 * reproduces the same options.
 */

export interface BuildOptionsSpec {
  word: Word
  words: readonly Word[]
  rng: () => number
  /** The text shown for an option (a word, a meaning, ...). */
  label: (word: Word) => string
  /** Candidates that may not be offered, e.g. words without approved art. */
  accept?: (word: Word) => boolean
  /** Picture options omit the label entirely. */
  includeLabel?: boolean
}

export interface BuiltOptions {
  answerId: string
  options: ExerciseOption[]
}

export function rngFor(context: ModeContext, salt: string): () => number {
  return createRng(hashString(`${context.seed}|${salt}`))
}

/**
 * Pick up to three distractors — same level first, then same topic, then any
 * word — and shuffle them together with the answer.
 */
export function buildOptions(spec: BuildOptionsSpec): BuiltOptions {
  const wanted = config.exercise.options - 1
  const answerLabel = normalise(spec.label(spec.word))
  const seenLabels = new Set([answerLabel])
  const chosen: Word[] = []

  for (const tier of candidateTiers(spec.words, spec.word)) {
    for (const candidate of shuffle(tier, spec.rng)) {
      if (chosen.length >= wanted) {
        break
      }

      if (spec.accept !== undefined && !spec.accept(candidate)) {
        continue
      }

      const label = spec.label(candidate).trim()

      if (label === "" || seenLabels.has(normalise(label))) {
        continue
      }

      seenLabels.add(normalise(label))
      chosen.push(candidate)
    }

    if (chosen.length >= wanted) {
      break
    }
  }

  const includeLabel = spec.includeLabel ?? true
  const options = shuffle([spec.word, ...chosen], spec.rng).map(
    (word): ExerciseOption =>
      includeLabel
        ? { id: word.id, wordId: word.id, label: spec.label(word) }
        : { id: word.id, wordId: word.id },
  )

  return { answerId: spec.word.id, options }
}

/** Hint level 1 for a choice mode: remove one non-answer option. */
export function removeDistractor<
  E extends { answerId: string; options: readonly ExerciseOption[] },
>(exercise: E): E {
  const index = exercise.options.findIndex(
    (option) => option.id !== exercise.answerId,
  )

  if (index === -1) {
    return exercise
  }

  return {
    ...exercise,
    options: exercise.options.filter((_, optionIndex) => optionIndex !== index),
  }
}

function candidateTiers(
  words: readonly Word[],
  target: Word,
): readonly (readonly Word[])[] {
  const sameLevel: Word[] = []
  const sameTopic: Word[] = []
  const rest: Word[] = []
  const topics = new Set(target.topicIds)

  for (const word of words) {
    if (word.id === target.id) {
      continue
    }

    if (word.level === target.level) {
      sameLevel.push(word)
    } else if (word.topicIds.some((topicId) => topics.has(topicId))) {
      sameTopic.push(word)
    } else {
      rest.push(word)
    }
  }

  return [sameLevel, sameTopic, rest]
}

function normalise(label: string): string {
  return label.trim().toLowerCase()
}
