import { buildOptions, rngFor } from "./options"
import type {
  ExerciseAnswer,
  ExerciseModule,
  FillBlankExercise,
} from "./types"

/**
 * The first English example with the target word removed on a word boundary.
 *
 * The content validator already guarantees the example contains the word; the
 * throw here keeps a hand-edited bundle from silently producing a blank that
 * hides nothing.
 */
export const fillBlank: ExerciseModule<FillBlankExercise> = {
  mode: "fillBlank",

  build(context) {
    const example = context.word.examples[0]

    if (!example) {
      throw new Error(`Word "${context.word.id}" has no example to fill.`)
    }

    const parts = extractBlank(example.en, context.word.text)

    if (parts === null) {
      throw new Error(
        `First example for "${context.word.id}" does not contain "${context.word.text}".`,
      )
    }

    const { answerId, options } = buildOptions({
      word: context.word,
      words: context.words,
      rng: rngFor(context, "fillBlank"),
      label: (word) => word.text,
    })

    return {
      mode: "fillBlank",
      wordId: context.word.id,
      answerId,
      options,
      before: parts.before,
      after: parts.after,
      translationZh: example.zh,
      firstLetter: null,
    }
  },

  check(exercise: FillBlankExercise, answer: ExerciseAnswer) {
    return answer.kind === "choice" && answer.optionId === exercise.answerId
  },

  hint1(exercise: FillBlankExercise) {
    const answer = exercise.options.find(
      (option) => option.id === exercise.answerId,
    )

    return {
      ...exercise,
      firstLetter: answer?.label?.charAt(0) ?? null,
    }
  },
}

/**
 * Split a sentence around the first case-insensitive, whole-word occurrence of
 * `word`. `null` means the word does not appear on a boundary.
 */
export function extractBlank(
  sentence: string,
  word: string,
): { before: string; after: string } | null {
  if (word === "") {
    return null
  }

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = new RegExp(
    `(^|[^a-zA-Z0-9])(${escaped})(?=[^a-zA-Z0-9]|$)`,
    "i",
  ).exec(sentence)

  if (!match) {
    return null
  }

  const start = match.index + match[1].length
  const end = start + match[2].length

  return {
    before: sentence.slice(0, start),
    after: sentence.slice(end),
  }
}
