import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

/**
 * The session's front door: what today holds, or the caught-up state. Nothing
 * has been written yet; Start is what advances the pure state machine.
 */
export function SessionLandingScreen() {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const { ready, preview, state, start, resume } = useSession()

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

  if (preview.caughtUp) {
    return (
      <section className="session-screen session-caught-up">
        <p className="session-emoji" aria-hidden="true">
          🌟
        </p>
        <h2 className="session-title">{t("session.caughtUpTitle")}</h2>
        <p className="session-lead">{t("session.caughtUpBody")}</p>
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
      <ul className="session-facts">
        {preview.reviewCount > 0 ? (
          <li className="session-fact">
            <span className="session-fact-badge" aria-hidden="true">
              🔁
            </span>
            {t("session.reviewCount", { count: preview.reviewCount })}
          </li>
        ) : null}
        {preview.newCount > 0 ? (
          <li className="session-fact">
            <span className="session-fact-badge" aria-hidden="true">
              ✨
            </span>
            {t("session.newWords", { count: preview.newCount })}
          </li>
        ) : null}
      </ul>

      <p className="session-meta">{t("session.aboutMinutes")}</p>

      <button type="button" className="primary-button" onClick={start}>
        {t("session.start")}
      </button>
    </section>
  )
}
