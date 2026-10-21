import { config } from "../config"

import { buildOptions, removeDistractor, rngFor } from "./options"
import type {
  ExerciseAnswer,
  ExerciseModule,
  ListenChooseExercise,
} from "./types"

/**
 * Tap the speaker, then choose. Pictures are preferred; when the content or
 * the manifest cannot offer three approved illustrations, the options fall
 * back to words so the mode is still playable.
 */
export const listenChoose: ExerciseModule<ListenChooseExercise> = {
  mode: "listenChoose",

  build(context) {
    const pictureOptions = buildOptions({
      word: context.word,
      words: context.words,
      rng: rngFor(context, "listenChoose"),
      label: (word) => word.text,
      accept: (word) => context.hasArt(word),
      includeLabel: false,
    })

    if (
      context.hasArt(context.word) &&
      pictureOptions.options.length >= config.exercise.minOptions
    ) {
      return {
        mode: "listenChoose",
        wordId: context.word.id,
        answerId: pictureOptions.answerId,
        options: pictureOptions.options,
        presentation: "picture",
      }
    }

    const wordOptions = buildOptions({
      word: context.word,
      words: context.words,
      // A separate salt keeps the fallback from inheriting the picture draw.
      rng: rngFor(context, "listenChoose|words"),
      label: (word) => word.text,
    })

    return {
      mode: "listenChoose",
      wordId: context.word.id,
      answerId: wordOptions.answerId,
      options: wordOptions.options,
      presentation: "word",
    }
  },

  check(exercise: ListenChooseExercise, answer: ExerciseAnswer) {
    return answer.kind === "choice" && answer.optionId === exercise.answerId
  },

  hint1: removeDistractor,
}
