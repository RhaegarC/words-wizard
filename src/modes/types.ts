import type { Locale, Word } from "../domain/types"

/**
 * The practice-mode contract.
 *
 * A mode turns a word into a deterministic `Exercise`, checks one answer, and
 * knows what hint level 1 means for its own shape. The session engine builds,
 * checks, and hints through this seam without knowing what a letter tile is.
 */

/** Everything a mode may read. Nothing here reaches storage. */
export interface ModeContext {
  word: Word
  /** The full content set, for distractors. */
  words: readonly Word[]
  locale: Locale
  /** Stable per-exercise seed: session seed + word + mode. */
  seed: string
  speechAvailable: boolean
  /** Whether a word has approved art; content stays outside the domain. */
  hasArt: (word: Word) => boolean
}

export interface ExerciseOption {
  /** Unique within the exercise; compared against `answerId`. */
  id: string
  wordId: string
  /** Visible text. Absent for picture options, so the spelling is not shown. */
  label?: string
}

interface ChoiceExerciseBase {
  /** The target word. */
  wordId: string
  answerId: string
  options: readonly ExerciseOption[]
}

export interface PictureMatchExercise extends ChoiceExerciseBase {
  mode: "pictureMatch"
}

export interface WordToMeaningExercise extends ChoiceExerciseBase {
  mode: "wordToMeaning"
}

export interface ListenChooseExercise extends ChoiceExerciseBase {
  mode: "listenChoose"
  /** Picture options carry no labels; the fallback shows word text. */
  presentation: "picture" | "word"
}

export interface FillBlankExercise extends ChoiceExerciseBase {
  mode: "fillBlank"
  /** The first English example split around the removed word. */
  before: string
  after: string
  /** Shown as support regardless of the UI locale. */
  translationZh: string
  firstLetter: string | null
}

export interface SpellingTile {
  id: string
  letter: string
}

export interface SpellingExercise {
  mode: "spellingBuilder"
  wordId: string
  answer: string
  tiles: readonly SpellingTile[]
  firstLetter: string | null
}

export type ChoiceExercise =
  | PictureMatchExercise
  | WordToMeaningExercise
  | ListenChooseExercise
  | FillBlankExercise

export type Exercise = ChoiceExercise | SpellingExercise

export type ExerciseAnswer =
  | { kind: "choice"; optionId: string }
  | { kind: "letters"; letters: readonly string[] }

export interface ExerciseModule<E extends Exercise> {
  mode: E["mode"]
  build(context: ModeContext): E
  check(exercise: E, answer: ExerciseAnswer): boolean
  /**
   * Hint level 1: drop one distractor, or reveal the first letter. The chosen
   * option is kept when a distractor is removed so its highlight survives.
   */
  hint1(exercise: E, preserveOptionId?: string): E
}

export interface ExerciseModules {
  pictureMatch: ExerciseModule<PictureMatchExercise>
  wordToMeaning: ExerciseModule<WordToMeaningExercise>
  spellingBuilder: ExerciseModule<SpellingExercise>
  fillBlank: ExerciseModule<FillBlankExercise>
  listenChoose: ExerciseModule<ListenChooseExercise>
}
