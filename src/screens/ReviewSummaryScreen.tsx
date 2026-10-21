import { useEffect, useRef } from "react"

import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

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

  if (state.phase !== "complete" || result === null) {
    return <SessionFallback />
  }

  // A direct visit to `#/review/summary` starts idle and is redirected by the
  // host before it can reach this screen; until the commit lands, say so.
  if (summary === null) {
    return (
      <section className="session-screen session-summary">
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
    <section className="session-screen session-summary review-summary">
      <p className="session-emoji" aria-hidden="true">
        💛
      </p>

      <h2 className="session-title">{t("review.summaryTitle")}</h2>
      <p className="review-summary-line">
        {t("review.summary", {
          count: reviewed,
          reviewed,
          strong,
          needs: needsVisit,
        })}
      </p>

      <ul className="session-summary-list">
        <li>
          {t("review.strong")}: {strong}
        </li>
        <li>
          {t("review.needsLook")}: {needsVisit}
        </li>
      </ul>

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
            onClick={() => replace({ id: "home" })}
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
          onClick={() => replace({ id: "home" })}
        >
          {t("session.backHome")}
        </button>
      )}
    </section>
  )
}
