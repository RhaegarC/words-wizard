import { useCallback, useMemo } from "react"

import { ExerciseView } from "../components/ExerciseView"
import { getAllWords, getArtwork, getWord } from "../content"
import { exerciseSeed, isLastExercise } from "../domain/session"
import type { PracticeMode, Word } from "../domain/types"
import { wordMeaning } from "../i18n/content"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"
import {
  applyHint1,
  buildExercise,
  checkAnswer,
  type Exercise,
  type ExerciseAnswer,
} from "../modes"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

const MODE_KEYS: Record<PracticeMode, MessageKey> = {
  pictureMatch: "modes.pictureMatch",
  wordToMeaning: "modes.wordToMeaning",
  spellingBuilder: "modes.spellingBuilder",
  fillBlank: "modes.fillBlank",
  listenChoose: "modes.listenChoose",
}

/** Approved art is the only art listen & choose offers as pictures. */
const hasApprovedArt = (word: Word) => getArtwork(word.id)?.status === "approved"

/**
 * The exercise host. It asks the mode registry for an `Exercise`, renders it
 * by mode, and owns the attempt and feedback ladder. No mode writes storage.
 */
export function SessionExerciseScreen() {
  const { locale, t } = useLocale()
  const { state, dispatch, speechAvailable, speakWord } = useSession()
  const planned = state.plan.words[state.wordIndex]
  const word = planned ? getWord(planned.wordId) : undefined
  const mode = planned?.modes[state.exerciseIndex]

  const exercise = useMemo(() => {
    if (!word || !mode) {
      return null
    }

    return buildExercise(mode, {
      word,
      words: getAllWords(),
      locale,
      seed: exerciseSeed(state.seed, word.id, mode),
      speechAvailable,
      hasArt: hasApprovedArt,
    })
  }, [word, mode, locale, state.seed, speechAvailable])

  // Hint level 1 transforms the exercise itself; level 2 is the host's copy.
  const shown = useMemo(() => {
    if (!exercise) {
      return null
    }

    return state.attempt.hintLevel >= 1
      ? applyHint1(exercise.mode, exercise)
      : exercise
  }, [exercise, state.attempt.hintLevel])

  // Every mode's check lives in its module; the host only routes the answer.
  const answer = useCallback(
    (response: ExerciseAnswer) => {
      if (!shown) {
        return
      }

      dispatch({
        type: "answer",
        correct: checkAnswer(shown.mode, shown, response),
      })
    },
    [dispatch, shown],
  )

  if (
    (state.phase !== "exercise" && state.phase !== "feedback") ||
    !planned ||
    !word ||
    !mode ||
    !shown
  ) {
    return <SessionFallback />
  }

  const totalExercises = state.plan.words.reduce(
    (total, entry) => total + entry.modes.length,
    0,
  )
  const exerciseNumber = Math.min(state.attempts.length + 1, totalExercises)
  const showAnswer = state.feedback === "reveal"
  const disabled = state.feedback !== null
  let hint = t("feedback.hint1Choice")

  if (state.feedback === "hint") {
    if (state.attempt.hintLevel >= 2) {
      hint = t("feedback.hint2", { clue: wordMeaning(word, locale) })
    } else if (mode === "spellingBuilder") {
      hint = t("feedback.hint1Spelling", {
        letter: firstLetterOf(shown) ?? word.text.charAt(0),
      })
    } else if (mode === "fillBlank") {
      hint = t("feedback.hint1FillBlank", {
        letter: firstLetterOf(shown) ?? word.text.charAt(0),
      })
    }
  }

  return (
    <section className="session-screen">
      <div className="session-progress-row">
        <span className="session-progress-label">
          {t("session.progress", {
            current: exerciseNumber,
            total: totalExercises,
          })}
        </span>
        <span className="session-badge">
          {planned.kind === "new"
            ? t("session.badgeNew")
            : planned.kind === "review"
              ? t("session.badgeReview")
              : t("session.badgeComprehensive")}
        </span>
      </div>

      <p className="session-mode-label">{t(MODE_KEYS[mode])}</p>

      <ExerciseView
        // A new exercise starts from clean local UI state (spelling tiles).
        key={`${state.wordIndex}:${state.exerciseIndex}`}
        exercise={shown}
        word={word}
        disabled={disabled}
        speechAvailable={speechAvailable}
        onAnswer={answer}
        onSpeak={() => speakWord(word.text)}
      />

      {state.feedback === null ? null : (
        <div
          className="feedback-panel"
          data-kind={state.feedback}
          role="status"
          aria-live="polite"
        >
          {state.feedback === "correct" ? (
            <>
              <p className="feedback-title">{t("feedback.correct")}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  dispatch({ type: "continueFeedback", now: Date.now() })
                }
              >
                {isLastExercise(state) ? t("session.finish") : t("session.next")}
              </button>
            </>
          ) : null}

          {state.feedback === "hint" ? (
            <>
              <p className="feedback-title">{t("feedback.almost")}</p>
              <p className="feedback-hint">{hint}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  dispatch({ type: "continueFeedback", now: Date.now() })
                }
              >
                {t("common.retry")}
              </button>
            </>
          ) : null}

          {showAnswer ? (
            <>
              <p className="feedback-title">{t("session.revealTitle")}</p>
              <p className="feedback-answer">
                {t("feedback.correctAnswer", {
                  answer: `${word.text} — ${wordMeaning(word, locale)}`,
                })}
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  dispatch({ type: "confirmReveal", now: Date.now() })
                }
              >
                {t("session.gotIt")}
              </button>
            </>
          ) : null}
        </div>
      )}
    </section>
  )
}

function firstLetterOf(exercise: Exercise): string | null {
  return exercise.mode === "spellingBuilder" || exercise.mode === "fillBlank"
    ? exercise.firstLetter
    : null
}
