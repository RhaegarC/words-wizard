import { WordArtwork } from "../components/WordArtwork"
import { getWord } from "../content"
import { isLastExercise } from "../domain/session"
import type { PracticeMode } from "../domain/types"
import { wordMeaning } from "../i18n/content"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

const MODE_KEYS: Record<PracticeMode, MessageKey> = {
  pictureMatch: "modes.pictureMatch",
  wordToMeaning: "modes.wordToMeaning",
  spellingBuilder: "modes.spellingBuilder",
  fillBlank: "modes.fillBlank",
  listenChoose: "modes.listenChoose",
}

/**
 * The exercise host. Feature 08 replaces the self-check body with the mode
 * modules; the host already owns progress, the answer callbacks, and the
 * feedback ladder, so a mode only has to say "correct" or "not yet".
 */
export function SessionExerciseScreen() {
  const { locale, t } = useLocale()
  const { state, dispatch, speechAvailable, speakWord } = useSession()
  const planned = state.plan.words[state.wordIndex]
  const word = planned ? getWord(planned.wordId) : undefined
  const mode = planned?.modes[state.exerciseIndex]

  if (
    (state.phase !== "exercise" && state.phase !== "feedback") ||
    !planned ||
    !word ||
    !mode
  ) {
    return <SessionFallback />
  }

  const totalExercises = state.plan.words.reduce(
    (total, entry) => total + entry.modes.length,
    0,
  )
  const exerciseNumber = Math.min(state.attempts.length + 1, totalExercises)
  const showAnswer = state.feedback === "reveal"

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
            : t("session.badgeReview")}
        </span>
      </div>

      <p className="session-mode-label">{t(MODE_KEYS[mode])}</p>

      <div className="exercise-card">
        <WordArtwork word={word} className="exercise-art" />

        <div className="exercise-heading">
          <h2 className="exercise-word">{word.text}</h2>
          <button
            type="button"
            className="listen-button"
            onClick={() => speakWord(word.text)}
            disabled={!speechAvailable}
            aria-label={`${t("session.listen")}: ${word.text}`}
          >
            <span aria-hidden="true">🔊</span>
          </button>
        </div>
      </div>

      {state.feedback === null ? (
        <div className="session-actions">
          <p className="session-question">{t("session.selfCheck")}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => dispatch({ type: "answer", correct: true })}
          >
            {t("session.knowIt")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => dispatch({ type: "answer", correct: false })}
          >
            {t("session.notYet")}
          </button>
        </div>
      ) : (
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
              <p className="feedback-hint">
                {state.attempt.hintLevel >= 2
                  ? t("feedback.hint2", {
                      clue: wordMeaning(word, locale),
                    })
                  : t("feedback.hint1")}
              </p>
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
