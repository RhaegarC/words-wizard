import { useEffect, useRef } from "react"

import { config } from "../config"
import { useLocale } from "../i18n/LocaleProvider"
import { stageMessageKey } from "../i18n/stages"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

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
      <section className="summary">
        <p role="status" className="session-loading">
          {t("session.saving")}
        </p>
      </section>
    )
  }

  const percent = Math.round(summary.progress.fraction * 100)
  const stageBefore = t(stageMessageKey(summary.stageBefore))
  const stageAfter = t(stageMessageKey(summary.stageAfter))
  const stageChanged = summary.stageBefore !== summary.stageAfter
  const tokensFull = summary.careTokens >= config.careTokens.cap
  const saving = commitStatus !== "done" && commitStatus !== "error"

  return (
    <section className="summary">
      <p className="summary-art" aria-hidden="true">
        🎉
      </p>

      <span className="eyebrow">{t("session.questEyebrow")}</span>
      <h2 className="summary-title">{t("session.summaryTitle")}</h2>
      <p className="summary-xp">
        {t("session.xpEarned", { count: summary.xpEarned })}
      </p>

      <div className="summary-grid">
        <span>
          <b>{summary.wordsPracticed}</b>
          <small>{t("session.wordsCompletedLabel")}</small>
        </span>
        <span>
          <b>{summary.wordsMastered}</b>
          <small>{t("session.wordsMasteredLabel")}</small>
        </span>
        <span>
          <b>{summary.streakCount}</b>
          <small>{t("home.streak")}</small>
        </span>
        <span>
          <b>
            {summary.careTokens}
            <span aria-hidden="true"> / </span>
            {config.careTokens.cap}
          </b>
          <small>{t("home.careTokens")}</small>
        </span>
      </div>

      <div className="summary-stage">
        <div className="growth-label">
          <span>
            {stageChanged ? `${stageBefore} → ${stageAfter}` : stageAfter}
          </span>
          {stageChanged ? (
            <b className="session-stage-up">{t("session.stageUp")}</b>
          ) : (
            <b>{percent}%</b>
          )}
        </div>
        <div
          className="progress"
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
          <i style={{ width: `${percent}%` }} />
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
            className="button primary wide"
            ref={retryRef}
            onClick={retryCommit}
          >
            {t("session.retrySave")}
          </button>
          <button
            type="button"
            className="button secondary wide"
            onClick={() => navigate({ id: "home" })}
          >
            {t("session.backHome")}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="button primary wide"
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
