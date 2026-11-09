import { WordArtwork } from "../components/WordArtwork"
import { Icon } from "../components/Icon"
import { getWord } from "../content"
import { estimatedMinutes, screenCount } from "@shared/session"
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
  const { ready, plan, preview, state, start, resume } = useSession()

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

  if (preview.caughtUp) {
    return (
      <section className="session-intro">
        <p className="session-emoji" aria-hidden="true">
          🌟
        </p>
        <h2 className="session-title">{t("session.caughtUpTitle")}</h2>
        <p className="session-lead">{t("session.caughtUpBody")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "home" })}
        >
          {t("session.backHome")}
        </button>
      </section>
    )
  }

  const previewWords = plan.words
    .slice(0, 6)
    .map((entry) => getWord(entry.wordId))
    .filter((word) => word !== undefined)

  return (
    <section className="session-intro">
      <div className="session-orbit" aria-hidden="true">
        <Icon name="sparkle" size={38} />
      </div>

      <span className="eyebrow">{t("session.questEyebrow")}</span>
      <h2 className="session-title">{t("session.introTitle")}</h2>
      <p className="session-lead">
        {preview.repeatCount > 0
          ? t("home.practiceAgainBody", { count: preview.repeatCount })
          : t("session.questBody")}
      </p>

      <div className="session-plan">
        <span>
          <b>{preview.newCount + preview.repeatCount}</b>
          {t("session.planNew")}
        </span>
        <span>
          <b>{screenCount(plan)}</b>
          {t("session.planSteps")}
        </span>
        <span>
          <b>{estimatedMinutes(plan)}</b>
          {t("session.planMinutes")}
        </span>
      </div>

      {previewWords.length > 0 ? (
        <div className="preview-words" aria-hidden="true">
          {previewWords.map((word) => (
            <WordArtwork
              key={word.id}
              word={word}
              className="preview-art"
              alt=""
            />
          ))}
        </div>
      ) : null}

      <div className="quest-chips session-chips">
        {preview.reviewCount > 0 ? (
          <span>{t("session.reviewCount", { count: preview.reviewCount })}</span>
        ) : null}
        {preview.newCount > 0 ? (
          <span>{t("session.newWords", { count: preview.newCount })}</span>
        ) : null}
        {preview.repeatCount > 0 ? (
          <span>
            {t("session.practiceAgainWords", { count: preview.repeatCount })}
          </span>
        ) : null}
        <span>{t("session.comprehensivePractice")}</span>
      </div>

      <button type="button" className="button primary" onClick={start}>
        <Icon name="play" size={19} />
        {preview.repeatCount > 0
          ? t("session.practiceAgain")
          : t("session.start")}
      </button>
    </section>
  )
}
