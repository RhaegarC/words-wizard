import { Icon } from "../components/Icon"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * Feature 34. The Practice nav's front door: a daily quest, free practice, or
 * the topic exam. The exam card stays disabled until feature 35 lands and
 * supplies its gate.
 */
export function PracticeHubScreen() {
  const { t } = useLocale()
  const { navigate } = useRouter()

  return (
    <section className="word-page">
      <header>
        <div>
          <span className="eyebrow">{t("session.questEyebrow")}</span>
          <h2>{t("session.hub.title")}</h2>
          <p>{t("session.hub.lead")}</p>
        </div>
      </header>

      <div className="feature-grid">
        <button
          type="button"
          className="feature-card"
          onClick={() => navigate({ id: "session" })}
        >
          <i className="feature-icon feature-icon-words" aria-hidden="true">
            <Icon name="sparkle" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("session.hub.dailyTitle")}</small>
            <b>{t("session.hub.dailyBody")}</b>
          </span>
          <Icon name="arrow" />
        </button>

        <button
          type="button"
          className="feature-card"
          onClick={() => navigate({ id: "session-free" })}
        >
          <i className="feature-icon feature-icon-words" aria-hidden="true">
            <Icon name="book" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("session.hub.freeTitle")}</small>
            <b>{t("session.hub.freeBody")}</b>
          </span>
          <Icon name="arrow" />
        </button>

        <button type="button" className="feature-card" disabled>
          <i className="feature-icon feature-icon-review" aria-hidden="true">
            <Icon name="shield" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("session.hub.examTitle")}</small>
            <b>{t("session.hub.examBody")}</b>
            <em>{t("session.hub.examSoon")}</em>
          </span>
        </button>
      </div>
    </section>
  )
}
