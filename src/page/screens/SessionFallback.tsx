import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/** A session route opened without the session that belongs to it. */
export function SessionFallback() {
  const { t } = useLocale()
  const { navigate } = useRouter()

  return (
    <section className="session-screen">
      <p className="session-lead">{t("session.notStarted")}</p>
      <button
        type="button"
        className="secondary-button"
        onClick={() => navigate({ id: "session" })}
      >
        {t("session.goToSession")}
      </button>
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
