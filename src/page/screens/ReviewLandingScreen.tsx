import { Icon } from "../components/Icon"
import { WordArtwork } from "../components/WordArtwork"
import { getWord } from "../content"
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
      <section className="review-page">
        <p role="status" className="session-loading">
          {t("session.loading")}
        </p>
      </section>
    )
  }

  if (state.phase !== "idle") {
    return (
      <section className="review-page">
        <p className="session-lead">{t("session.inProgress")}</p>
        <button type="button" className="button primary" onClick={resume}>
          {t("common.continue")}
        </button>
      </section>
    )
  }

  if (!reviewDue || plan.caughtUp) {
    return (
      <section className="review-page">
        <p className="session-emoji" aria-hidden="true">
          🌱
        </p>
        <h2 className="session-title">{t("review.noneDueTitle")}</h2>
        <p className="session-lead">{t("review.noneDue")}</p>
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
    <section className="review-page">
      <div className="review-art" aria-hidden="true">
        <Icon name="sparkle" size={38} />
      </div>

      <span className="eyebrow">{t("review.eyebrow")}</span>
      <h2 className="session-title">{t("review.title")}</h2>
      <p className="session-lead">
        {t("review.intro", { count: plan.words.length })}
      </p>

      {previewWords.length > 0 ? (
        <div className="review-preview" aria-hidden="true">
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

      <p className="session-meta">{t("review.oneExercise")}</p>

      <button type="button" className="button primary" onClick={start}>
        {t("review.startCount", { count: plan.words.length })}
        <Icon name="arrow" />
      </button>
      <button
        type="button"
        className="quiet-action"
        onClick={() => navigate({ id: "home" })}
      >
        {t("review.maybeLater")}
      </button>
    </section>
  )
}
