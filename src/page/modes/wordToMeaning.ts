import { wordMeaning } from "../i18n/content"

import { buildOptions, removeDistractor, rngFor } from "./options"
import type {
  ExerciseAnswer,
  ExerciseModule,
  WordToMeaningExercise,
} from "./types"

/** English word prompt, meaning options in the active UI language. */
export const wordToMeaning: ExerciseModule<WordToMeaningExercise> = {
  mode: "wordToMeaning",

  build(context) {
    const { answerId, options } = buildOptions({
      word: context.word,
      words: context.words,
      rng: rngFor(context, "wordToMeaning"),
      label: (word) => wordMeaning(word, context.locale),
    })

    return {
      mode: "wordToMeaning",
      wordId: context.word.id,
      answerId,
      options,
    }
  },

  check(exercise: WordToMeaningExercise, answer: ExerciseAnswer) {
    return answer.kind === "choice" && answer.optionId === exercise.answerId
  },

  hint1: removeDistractor,
}
