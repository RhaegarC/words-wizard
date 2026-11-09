import { useEffect, useRef } from "react"

import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

/**
 * PRD §7.4's tone guardrail: words are "still strong" or "want another visit",
 * never forgotten. The review commits through the same session transaction.
 */
export function ReviewSummaryScreen() {
  const { t } = useLocale()
  const { replace } = useRouter()
  const { state, result, commitStatus, summary, retryCommit } = useSession()
  const backRef = useRef<HTMLButtonElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (commitStatus === "done") {
      backRef.current?.focus()
    } else if (commitStatus === "error") {
      retryRef.current?.focus()
    }
  }, [commitStatus])

  // A direct visit to `#/review/summary` starts idle and is redirected by the
  // host before it can reach this screen. Until the session completes, say so
  // rather than offering the daily-session fallback, which points elsewhere.
  if (state.phase !== "complete" || result === null) {
    return (
      <section className="summary">
        <p role="status" className="session-loading">
          {t("session.saving")}
        </p>
      </section>
    )
  }

  // A direct visit to `#/review/summary` starts idle and is redirected by the
  // host before it can reach this screen; until the commit lands, say so.
  if (summary === null) {
    return (
      <section className="summary">
        <p role="status" className="session-loading">
          {t("session.saving")}
        </p>
      </section>
    )
  }

  const review = summary.review
  const reviewed = review?.reviewed ?? summary.wordsPracticed
  const strong = review?.strong ?? 0
  const needsVisit = review?.needsVisit ?? reviewed
  const saving = commitStatus !== "done" && commitStatus !== "error"

  return (
    <section className="summary">
      <p className="summary-art" aria-hidden="true">
        💛
      </p>

      <span className="eyebrow">{t("review.eyebrow")}</span>
      <h2 className="summary-title">{t("review.summaryTitle")}</h2>
      <p className="summary-lead">
        {t("review.summary", {
          count: reviewed,
          reviewed,
          strong,
          needs: needsVisit,
        })}
      </p>

      <div className="summary-grid summary-grid-three">
        <span>
          <b>{reviewed}</b>
          <small>{t("review.reviewed")}</small>
        </span>
        <span>
          <b>{strong}</b>
          <small>{t("review.strong")}</small>
        </span>
        <span>
          <b>{needsVisit}</b>
          <small>{t("review.needsLook")}</small>
        </span>
      </div>

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
            onClick={() => replace({ id: "home" })}
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
          onClick={() => replace({ id: "home" })}
        >
          {t("session.backHome")}
        </button>
      )}
    </section>
  )
}
