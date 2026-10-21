import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

/**
 * The end of the pure loop. The `SessionResult` is complete and in memory;
 * feature 09 replaces this screen with the one that commits it.
 */
export function SessionSummaryScreen() {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const { state, result } = useSession()

  if (state.phase !== "complete" || result === null) {
    return <SessionFallback />
  }

  return (
    <section className="session-screen session-summary">
      <p className="session-emoji" aria-hidden="true">
        🎉
      </p>

      <p className="session-xp">{t("session.xpEarned", { count: result.xpEarned })}</p>
      <p className="session-lead">
        {t("session.wordsCompleted", { count: result.words.length })}
      </p>
      <p className="session-meta">{t("session.summaryPending")}</p>

      <button
        type="button"
        className="primary-button"
        onClick={() => navigate({ id: "home" })}
      >
        {t("session.backHome")}
      </button>
    </section>
  )
}
