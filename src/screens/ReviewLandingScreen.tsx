import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

/**
 * PRD §7.4: the review is offered, never imposed. The card only routes here
 * when due, but a direct visit to `#/review` still needs an honest empty state.
 */
export function ReviewLandingScreen() {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const { ready, reviewDue, plan, state, start, resume } = useSession()

  if (!ready) {
    return (
      <section className="session-screen">
        <p role="status" className="session-loading">
          {t("session.loading")}
        </p>
      </section>
    )
  }

  if (state.phase !== "idle") {
    return (
      <section className="session-screen">
        <p className="session-lead">{t("session.inProgress")}</p>
        <button type="button" className="primary-button" onClick={resume}>
          {t("common.continue")}
        </button>
      </section>
    )
  }

  if (!reviewDue || plan.caughtUp) {
    return (
      <section className="session-screen session-caught-up">
        <p className="session-emoji" aria-hidden="true">
          🌱
        </p>
        <h2 className="session-title">{t("review.noneDueTitle")}</h2>
        <p className="session-lead">{t("review.noneDue")}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate({ id: "home" })}
        >
          {t("session.backHome")}
        </button>
      </section>
    )
  }

  return (
    <section className="session-screen">
      <p className="session-emoji" aria-hidden="true">
        📅
      </p>
      <h2 className="session-title">{t("review.title")}</h2>
      <p className="session-lead">
        {t("review.intro", { count: plan.words.length })}
      </p>
      <p className="session-meta">{t("review.oneExercise")}</p>

      <button type="button" className="primary-button" onClick={start}>
        {t("review.start")}
      </button>
    </section>
  )
}
