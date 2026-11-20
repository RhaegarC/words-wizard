import { Icon } from "../components/Icon"
import { getPack } from "../content"
import { estimatedMinutes } from "@shared/session"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { useSession } from "../session/SessionProvider"

/**
 * Feature 34. The selected free pack's front door. The plan contains only
 * introduced words, so Start moves straight to the first review exercise.
 */
export function FreePracticeLandingScreen({ packId }: { packId: string }) {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { ready, plan, state, start, resume } = useSession()
  const pack = getPack(packId)

  if (!ready) {
    return (
      <section className="session-intro">
        <p role="status" className="session-loading">
          {t("session.loading")}
        </p>
      </section>
    )
  }

  if (state.phase !== "idle") {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("session.inProgress")}</p>
        <button type="button" className="button primary" onClick={resume}>
          {t("common.continue")}
        </button>
      </section>
    )
  }

  if (pack === undefined || plan.words.length === 0) {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("free.unavailable")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-free" })}
        >
          {t("free.backToPacks")}
        </button>
      </section>
    )
  }

  return (
    <section className="session-intro">
      <div className="session-orbit" aria-hidden="true">
        <Icon name="book" size={38} />
      </div>

      <span className="eyebrow">{t("session.hub.freeTitle")}</span>
      <h2 className="session-title">
        {locale === "zh" ? pack.titleZh : pack.title}
      </h2>
      <p className="session-lead">{t("free.landingLead")}</p>

      <div className="session-plan">
        <span>
          <b>{plan.words.length}</b>
          {t("free.wordsLabel")}
        </span>
        <span>
          <b>{estimatedMinutes(plan)}</b>
          {t("session.planMinutes")}
        </span>
      </div>

      <button type="button" className="button primary" onClick={start}>
        <Icon name="play" size={19} />
        {t("free.start")}
      </button>

      <button
        type="button"
        className="button secondary"
        onClick={() => navigate({ id: "session-free" })}
      >
        {t("free.backToPacks")}
      </button>
    </section>
  )
}
