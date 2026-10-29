import { useCallback, useEffect, useMemo, useState } from "react"

import { ExerciseView } from "../components/ExerciseView"
import { Icon } from "../components/Icon"
import { getAllWords, getWord } from "../content"
import { exerciseSeed, isLastExercise } from "@shared/session"
import type { PracticeMode, Word } from "@shared/types"
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
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

const MODE_KEYS: Record<PracticeMode, MessageKey> = {
  pictureMatch: "modes.pictureMatch",
  wordToMeaning: "modes.wordToMeaning",
  spellingBuilder: "modes.spellingBuilder",
  fillBlank: "modes.fillBlank",
  listenChoose: "modes.listenChoose",
}

/** Only an authored image is offered as a picture in listen & choose. */
const hasApprovedArt = (word: Word) => word.image !== null

/**
 * The exercise host. It asks the mode registry for an `Exercise`, renders it
 * by mode, and owns the attempt and feedback ladder. No mode writes storage.
 */
export function SessionExerciseScreen() {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { state, dispatch, speechAvailable, speakWord } = useSession()
  const planned = state.plan.words[state.wordIndex]
  const word = planned ? getWord(planned.wordId) : undefined
  const mode = planned?.modes[state.exerciseIndex]
  // The chosen option survives the hint that removes a distractor, so the
  // highlight stays on the answer the child actually picked.
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null)

  useEffect(() => {
    setChosenOptionId(null)
  }, [state.wordIndex, state.exerciseIndex])

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
      ? applyHint1(exercise.mode, exercise, chosenOptionId ?? undefined)
      : exercise
  }, [chosenOptionId, exercise, state.attempt.hintLevel])

  // Every mode's check lives in its module; the host only routes the answer.
  const answer = useCallback(
    (response: ExerciseAnswer) => {
      if (!shown) {
        return
      }

      if (response.kind === "choice") {
        setChosenOptionId(response.optionId)
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
  const percent = Math.round(
    ((exerciseNumber - 1) / Math.max(totalExercises, 1)) * 100,
  )
  const progressLabel = t("session.progress", {
    current: exerciseNumber,
    total: totalExercises,
  })
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
    <section className="practice">
      <header>
        <button
          type="button"
          className="practice-exit"
          aria-label={t("session.exitTitle")}
          onClick={() => navigate({ id: "home" })}
        >
          ←
        </button>
        <div
          className="practice-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={progressLabel}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <b>{progressLabel}</b>
      </header>

      <div className="exercise">
        <div className="exercise-meta">
          <span className="eyebrow">{t(MODE_KEYS[mode])}</span>
          <span className="session-badge">
            {planned.kind === "new"
              ? t("session.badgeNew")
              : planned.kind === "review"
                ? t("session.badgeReview")
                : planned.kind === "repeat"
                  ? t("session.badgeRepeat")
                  : t("session.badgeComprehensive")}
          </span>
        </div>

        <ExerciseView
          // A new exercise starts from clean local UI state (spelling tiles).
          key={`${state.wordIndex}:${state.exerciseIndex}`}
          exercise={shown}
          word={word}
          disabled={disabled}
          selectedOptionId={chosenOptionId}
          speechAvailable={speechAvailable}
          onAnswer={answer}
          onSpeak={() => speakWord(word.text)}
        />
      </div>

      {state.feedback === null ? null : (
        <div
          className={`feedback ${state.feedback === "correct" ? "success" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="feedback-copy">
            <b>
              {state.feedback === "correct"
                ? t("feedback.correct")
                : state.feedback === "hint"
                  ? t("feedback.almost")
                  : t("session.revealTitle")}
            </b>

            {state.feedback === "hint" ? <small>{hint}</small> : null}
            {showAnswer ? (
              <small>
                {t("feedback.correctAnswer", {
                  answer: `${word.text} — ${wordMeaning(word, locale)}`,
                })}
              </small>
            ) : null}
          </span>

          {state.feedback === "correct" ? (
            <button
              type="button"
              className="button primary"
              onClick={() =>
                dispatch({ type: "continueFeedback", now: Date.now() })
              }
            >
              {isLastExercise(state) ? t("session.finish") : t("session.next")}
              <Icon name="arrow" size={17} />
            </button>
          ) : null}

          {state.feedback === "hint" ? (
            <button
              type="button"
              className="button primary"
              onClick={() =>
                dispatch({ type: "continueFeedback", now: Date.now() })
              }
            >
              {t("common.retry")}
            </button>
          ) : null}

          {showAnswer ? (
            <button
              type="button"
              className="button primary"
              onClick={() => dispatch({ type: "confirmReveal", now: Date.now() })}
            >
              {t("session.gotIt")}
            </button>
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
