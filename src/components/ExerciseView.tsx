import { getWord } from "../content"
import type { Word } from "../domain/types"
import { wordMeaning } from "../i18n/content"
import { useLocale } from "../i18n/LocaleProvider"
import type {
  ChoiceExercise,
  Exercise,
  ExerciseAnswer,
} from "../modes"

import { SpellingBoard } from "./SpellingBoard"
import { WordArtwork } from "./WordArtwork"

export interface ExerciseViewProps {
  exercise: Exercise
  word: Word
  disabled: boolean
  /** The choice the child picked, highlighted through the feedback panel. */
  selectedOptionId: string | null
  speechAvailable: boolean
  /** The raw answer; the mode module checks it in the host. */
  onAnswer: (answer: ExerciseAnswer) => void
  onSpeak: () => void
}

/**
 * Renders the exercise body for its mode. The host never looks inside a mode;
 * it asks the module for an `Exercise` and hands it here.
 */
export function ExerciseView({
  exercise,
  word,
  disabled,
  selectedOptionId,
  speechAvailable,
  onAnswer,
  onSpeak,
}: ExerciseViewProps) {
  const { locale, t } = useLocale()

  switch (exercise.mode) {
    case "pictureMatch":
      return (
        <>
          <div className="exercise-card">
            <WordArtwork word={word} alt="" className="exercise-art" />
            <p className="exercise-prompt">{t("exercise.picturePrompt")}</p>
          </div>
          <ChoiceOptions
            exercise={exercise}
            disabled={disabled}
            selectedId={selectedOptionId}
            picture={false}
            onAnswer={onAnswer}
          />
        </>
      )

    case "wordToMeaning":
      return (
        <>
          <div className="exercise-card">
            <div className="exercise-heading">
              <h2 className="exercise-word">{word.text}</h2>
              <ListenButton
                disabled={!speechAvailable}
                label={`${t("session.listen")}: ${word.text}`}
                onSpeak={onSpeak}
              />
            </div>
            <p className="exercise-phonetic">{word.phonetic}</p>
            <p className="exercise-prompt">{t("exercise.meaningPrompt")}</p>
          </div>
          <ChoiceOptions
            exercise={exercise}
            disabled={disabled}
            selectedId={selectedOptionId}
            picture={false}
            onAnswer={onAnswer}
          />
        </>
      )

    case "spellingBuilder":
      return (
        <>
          <div className="exercise-card">
            <WordArtwork word={word} alt="" className="exercise-art" />
            <p className="exercise-meaning">{wordMeaning(word, locale)}</p>
            <p className="exercise-prompt">{t("exercise.spellingPrompt")}</p>
          </div>
          <SpellingBoard
            exercise={exercise}
            disabled={disabled}
            onComplete={(letters) => onAnswer({ kind: "letters", letters })}
          />
        </>
      )

    case "fillBlank":
      return (
        <>
          <div className="exercise-card">
            <p className="exercise-sentence">
              {exercise.before}
              <span className="exercise-blank" aria-label={t("exercise.blank")}>
                ______
              </span>
              {exercise.after}
            </p>
            <p className="exercise-translation" lang="zh">
              {exercise.translationZh}
            </p>
            <p className="exercise-prompt">{t("exercise.fillBlankPrompt")}</p>
          </div>
          <ChoiceOptions
            exercise={exercise}
            disabled={disabled}
            selectedId={selectedOptionId}
            picture={false}
            onAnswer={onAnswer}
          />
        </>
      )

    case "listenChoose":
      return (
        <>
          <div className="exercise-card exercise-listen-card">
            <ListenButton
              disabled={!speechAvailable}
              label={t("exercise.playWord")}
              onSpeak={onSpeak}
              large
            />
            {/* If audio fails, IPA is the fallback cue — never the spelling. */}
            {speechAvailable ? null : (
              <p className="exercise-phonetic">{word.phonetic}</p>
            )}
            <p className="exercise-prompt">{t("exercise.listenPrompt")}</p>
          </div>
          <ChoiceOptions
            exercise={exercise}
            disabled={disabled}
            selectedId={selectedOptionId}
            picture={exercise.presentation === "picture"}
            onAnswer={onAnswer}
          />
        </>
      )
  }
}

function ChoiceOptions({
  exercise,
  disabled,
  selectedId,
  picture,
  onAnswer,
}: {
  exercise: ChoiceExercise
  disabled: boolean
  selectedId: string | null
  picture: boolean
  onAnswer: (answer: ExerciseAnswer) => void
}) {
  const { t } = useLocale()
  // The host owns the selection so the hint can keep that option in place.
  const choose = (optionId: string) => onAnswer({ kind: "choice", optionId })

  return (
    <div
      className="exercise-options"
      role="group"
      aria-label={t("exercise.chooseOne")}
    >
      {exercise.options.map((option, index) =>
        picture ? (
          <PictureOption
            key={option.id}
            disabled={disabled}
            label={t("exercise.pictureOption", { index: index + 1 })}
            selected={option.id === selectedId}
            onChoose={() => choose(option.id)}
            wordId={option.wordId}
          />
        ) : (
          <button
            key={option.id}
            type="button"
            className={`option-button ${option.id === selectedId ? "option-button-selected" : ""}`}
            disabled={disabled}
            onClick={() => choose(option.id)}
          >
            {option.label}
          </button>
        ),
      )}
    </div>
  )
}

function PictureOption({
  wordId,
  label,
  disabled,
  selected,
  onChoose,
}: {
  wordId: string
  label: string
  disabled: boolean
  selected: boolean
  onChoose: () => void
}) {
  const word = getWord(wordId)

  if (!word) {
    return null
  }

  return (
    <button
      type="button"
      className={`option-button option-picture ${selected ? "option-button-selected" : ""}`}
      disabled={disabled}
      aria-label={label}
      onClick={onChoose}
    >
      <WordArtwork word={word} alt="" className="option-art" />
    </button>
  )
}

function ListenButton({
  disabled,
  label,
  large = false,
  onSpeak,
}: {
  disabled: boolean
  label: string
  large?: boolean
  onSpeak: () => void
}) {
  return (
    <button
      type="button"
      className={`listen-button ${large ? "listen-button-large" : ""}`}
      disabled={disabled}
      aria-label={label}
      onClick={onSpeak}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  )
}
