import { fillBlank } from "./fillBlank"
import { listenChoose } from "./listenChoose"
import { pictureMatch } from "./pictureMatch"
import { spellingBuilder } from "./spellingBuilder"
import type {
  Exercise,
  ExerciseAnswer,
  ExerciseModules,
  ModeContext,
} from "./types"
import { wordToMeaning } from "./wordToMeaning"

import type { PracticeMode } from "../domain/types"

/** The five mode modules, registered once for the session engine. */
export const MODULES = {
  pictureMatch,
  wordToMeaning,
  spellingBuilder,
  fillBlank,
  listenChoose,
} satisfies ExerciseModules

export function buildExercise(
  mode: PracticeMode,
  context: ModeContext,
): Exercise {
  switch (mode) {
    case "pictureMatch":
      return MODULES.pictureMatch.build(context)
    case "wordToMeaning":
      return MODULES.wordToMeaning.build(context)
    case "spellingBuilder":
      return MODULES.spellingBuilder.build(context)
    case "fillBlank":
      return MODULES.fillBlank.build(context)
    case "listenChoose":
      return MODULES.listenChoose.build(context)
  }
}

export function checkAnswer(
  mode: PracticeMode,
  exercise: Exercise,
  answer: ExerciseAnswer,
): boolean {
  if (exercise.mode !== mode) {
    return false
  }

  return checkNarrowed(exercise, answer)
}

export function applyHint1(
  mode: PracticeMode,
  exercise: Exercise,
  preserveOptionId?: string,
): Exercise {
  if (exercise.mode !== mode) {
    return exercise
  }

  switch (exercise.mode) {
    case "pictureMatch":
      return MODULES.pictureMatch.hint1(exercise, preserveOptionId)
    case "wordToMeaning":
      return MODULES.wordToMeaning.hint1(exercise, preserveOptionId)
    case "spellingBuilder":
      return MODULES.spellingBuilder.hint1(exercise)
    case "fillBlank":
      return MODULES.fillBlank.hint1(exercise)
    case "listenChoose":
      return MODULES.listenChoose.hint1(exercise, preserveOptionId)
  }
}

function checkNarrowed(exercise: Exercise, answer: ExerciseAnswer): boolean {
  switch (exercise.mode) {
    case "pictureMatch":
      return MODULES.pictureMatch.check(exercise, answer)
    case "wordToMeaning":
      return MODULES.wordToMeaning.check(exercise, answer)
    case "spellingBuilder":
      return MODULES.spellingBuilder.check(exercise, answer)
    case "fillBlank":
      return MODULES.fillBlank.check(exercise, answer)
    case "listenChoose":
      return MODULES.listenChoose.check(exercise, answer)
  }
}

export type {
  ChoiceExercise,
  Exercise,
  ExerciseAnswer,
  ExerciseModule,
  ExerciseModules,
  ExerciseOption,
  FillBlankExercise,
  ListenChooseExercise,
  ModeContext,
  PictureMatchExercise,
  SpellingExercise,
  SpellingTile,
  WordToMeaningExercise,
} from "./types"
