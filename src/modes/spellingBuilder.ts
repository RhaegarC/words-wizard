import { config } from "../config"
import { shuffle } from "../domain/random"

import { rngFor } from "./options"
import type {
  ExerciseAnswer,
  ExerciseModule,
  SpellingExercise,
} from "./types"

/**
 * Letter tiles: every letter of the answer, plus one to three distractors.
 *
 * Tiles carry unique ids because a word may repeat a letter — the check is on
 * the assembled letters, never on which tile was used.
 */
export const spellingBuilder: ExerciseModule<SpellingExercise> = {
  mode: "spellingBuilder",

  build(context) {
    const rng = rngFor(context, "spellingBuilder")
    const answer = context.word.text
    const letters = [...answer]
    const extra = 1 + Math.floor(rng() * config.exercise.maxExtraLetters)

    for (let index = 0; index < extra; index += 1) {
      letters.push(randomLetter(rng))
    }

    const tiles = shuffle(letters, rng).map((letter, index) => ({
      id: `${context.word.id}-tile-${index}`,
      letter,
    }))

    return {
      mode: "spellingBuilder",
      wordId: context.word.id,
      answer,
      tiles,
      firstLetter: null,
    }
  },

  check(exercise: SpellingExercise, answer: ExerciseAnswer) {
    if (answer.kind !== "letters") {
      return false
    }

    const assembled = answer.letters.join("")

    return (
      assembled.length === exercise.answer.length &&
      assembled.toLowerCase() === exercise.answer.toLowerCase()
    )
  },

  hint1(exercise: SpellingExercise) {
    return { ...exercise, firstLetter: exercise.answer.charAt(0) }
  },
}

function randomLetter(rng: () => number): string {
  return String.fromCharCode(97 + Math.floor(rng() * 26))
}
