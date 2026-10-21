import { buildOptions, removeDistractor, rngFor } from "./options"
import type {
  ExerciseAnswer,
  ExerciseModule,
  PictureMatchExercise,
} from "./types"

/** Illustration prompt, English word options. */
export const pictureMatch: ExerciseModule<PictureMatchExercise> = {
  mode: "pictureMatch",

  build(context) {
    const { answerId, options } = buildOptions({
      word: context.word,
      words: context.words,
      rng: rngFor(context, "pictureMatch"),
      label: (word) => word.text,
    })

    return {
      mode: "pictureMatch",
      wordId: context.word.id,
      answerId,
      options,
    }
  },

  check(exercise: PictureMatchExercise, answer: ExerciseAnswer) {
    return answer.kind === "choice" && answer.optionId === exercise.answerId
  },

  hint1: removeDistractor,
}
