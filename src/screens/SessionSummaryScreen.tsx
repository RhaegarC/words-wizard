import { useEffect, useRef } from "react"

import { config } from "../config"
import type { StageId } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

const STAGE_KEYS: Record<StageId, MessageKey> = {
  egg: "character.stage.egg",
  hatchling: "character.stage.hatchling",
  juvenile: "character.stage.juvenile",
  adult: "character.stage.adult",
  legendary: "character.stage.legendary",
}

/**
 * What the session earned, committed once before the numbers are shown. While
 * the transaction is open the exit button is disabled; a failure offers one
 * retry rather than pretending the progress was saved.
 */
export function SessionSummaryScreen() {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const { state, result, commitStatus, summary, retryCommit } = useSession()
  const backRef = useRef<HTMLButtonElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)

  // The retry button unmounts when it is activated, so focus is moved to the
  // control that reports the outcome instead of falling back to the document.
  useEffect(() => {
    if (commitStatus === "done") {
      backRef.current?.focus()
    } else if (commitStatus === "error") {
      retryRef.current?.focus()
    }
  }, [commitStatus])

  if (state.phase !== "complete" || result === null) {
    return <SessionFallback />
  }

  if (summary === null) {
    return (
      <section className="session-screen session-summary">
        <p role="status" className="session-loading">
          {t("session.saving")}
        </p>
      </section>
    )
  }

  const percent = Math.round(summary.progress.fraction * 100)
  const stageBefore = t(STAGE_KEYS[summary.stageBefore])
  const stageAfter = t(STAGE_KEYS[summary.stageAfter])
  const stageChanged = summary.stageBefore !== summary.stageAfter
  const tokensFull = summary.careTokens >= config.careTokens.cap
  const saving = commitStatus !== "done" && commitStatus !== "error"

  return (
    <section className="session-screen session-summary">
      <p className="session-emoji" aria-hidden="true">
        🎉
      </p>

      <h2 className="session-title">{t("session.summaryTitle")}</h2>
      <p className="session-xp">
        {t("session.xpEarned", { count: summary.xpEarned })}
      </p>

      <ul className="session-summary-list">
        <li>
          {t("session.wordsCompleted", { count: summary.wordsPracticed })}
        </li>
        <li>{t("session.wordsMastered", { count: summary.wordsMastered })}</li>
        <li>
          {t("home.streak")}:{" "}
          {t("home.streakDays", { count: summary.streakCount })}
        </li>
      </ul>

      <div className="session-stage">
        <p className="session-stage-names">
          {stageChanged ? `${stageBefore} → ${stageAfter}` : stageAfter}
        </p>
        {stageChanged ? (
          <p className="session-stage-up">{t("session.stageUp")}</p>
        ) : null}
        <div
          className="stage-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={
            summary.progress.nextStage === null
              ? t("session.stageMax")
              : t("session.stageProgress", {
                  current: summary.progress.xpIntoStage,
                  target: summary.progress.xpForNextStage,
                })
          }
        >
          <span
            className="stage-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="session-meta">
        {tokensFull
          ? t("session.careTokenFull", {
              count: summary.careTokens,
              total: config.careTokens.cap,
            })
          : t("session.careTokenProgress", {
              count: summary.sessionsSinceLastToken,
              total: config.careTokens.sessionsPerToken,
            })}
      </p>

      <p className="session-save-status" role="status" aria-live="polite">
        {commitStatus === "saving" ? t("session.saving") : null}
        {commitStatus === "done" ? t("session.saved") : null}
      </p>

      {commitStatus === "error" ? (
        <>
          <p role="alert" className="session-error">
            {t("session.saveError")}
          </p>
          <button
            type="button"
            className="primary-button"
            ref={retryRef}
            onClick={retryCommit}
          >
            {t("session.retrySave")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate({ id: "home" })}
          >
            {t("session.backHome")}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="primary-button"
          ref={backRef}
          disabled={saving}
          onClick={() => navigate({ id: "home" })}
        >
          {t("session.backHome")}
        </button>
      )}
    </section>
  )
}
