import { useEffect, useRef } from "react"

import { AvatarStage } from "../components/AvatarStage"
import { InstallPromptSlot } from "../components/InstallPromptSlot"
import { SleepOverlay } from "../components/SleepOverlay"
import { useProfileProgress } from "../components/useProfileProgress"
import { config } from "../config"
import { getHomeContent } from "../content"
import { progressProvider } from "../db"
import { METRIC_NAMES } from "../db/metrics"
import { buildHomeView } from "../domain/home"
import type { CharacterCondition, Profile } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"
import { stageMessageKey } from "../i18n/stages"
import { useRouter } from "../router/RouterContext"

const STATE_KEYS: Record<CharacterCondition, MessageKey> = {
  awake: "character.awake",
  sleepy: "character.sleepy",
  sleeping: "character.sleeping",
}

const CONTENT = getHomeContent()

/**
 * PRD §7.2, §7.5. Home is a derivation of the stored profile and progress;
 * `buildHomeView` owns every threshold and date rule, so this screen only
 * decides what to show and where each action goes.
 */
export function HomeScreen({
  profile,
  onProfileUpdated,
}: {
  profile: Profile
  onProfileUpdated: (profile: Profile) => void
}) {
  const { locale, t } = useLocale()
  const { navigate, replace } = useRouter()
  const { progress, failed: loadFailed } = useProfileProgress(profile.id)

  const view =
    progress === null
      ? null
      : buildHomeView({
          profile,
          progress,
          content: CONTENT,
          now: Date.now(),
          config,
        })

  // One "offered" per Home visit, not one per render while the card is due.
  const recordedReviewOffer = useRef(false)

  useEffect(() => {
    if (
      view?.monthlyReviewDue !== true ||
      recordedReviewOffer.current ||
      profile.id === undefined
    ) {
      return
    }

    recordedReviewOffer.current = true
    void progressProvider
      .incrementMetric(profile.id, METRIC_NAMES.monthlyReviewOffered)
      .catch((reason: unknown) => {
        console.warn("[home] Could not record the review offer", reason)
      })
  }, [profile.id, view?.monthlyReviewDue])

  useEffect(() => {
    if (view?.needsTopic) {
      // Replace, not push: a guard refactor must not leave a back-button loop.
      replace({ id: "topics" })
    }
  }, [replace, view?.needsTopic])

  if (view === null || view.needsTopic) {
    return (
      <section className="home-screen">
        <p role="status" className="home-loading">
          {t("common.loading")}
        </p>
      </section>
    )
  }

  const avatar = view.avatar
  const avatarName = avatar
    ? locale === "zh"
      ? avatar.nameZh
      : avatar.name
    : profile.characterName
  const stageName = t(stageMessageKey(view.character.stage))
  const stageStatus =
    view.stage.nextStage === null
      ? t("character.maxStage")
      : t("character.workingTowards", {
          next: t(stageMessageKey(view.stage.nextStage)),
        })
  const stagePercent = Math.round(view.stage.fraction * 100)
  const sessionsToNextToken = view.tokenProgress.sessionsToNextToken
  const showTokenHint =
    view.tokenProgress.showHint && sessionsToNextToken !== null

  return (
    <section className="home-screen">
      <header className="home-buddy">
        <button
          type="button"
          className="home-buddy-button"
          aria-label={`${t("home.buddy")}: ${profile.characterName} — ${stageName}`}
          onClick={() => navigate({ id: "character" })}
        >
          <AvatarStage
            avatar={avatar}
            stage={view.character.stage}
            alt={`${avatarName} — ${stageName}`}
            stageLabel={stageName}
            className="home-buddy-art"
          />
          <span className="home-buddy-cta">{t("home.buddy")}</span>
        </button>

        <div className="home-buddy-info">
          <h2 className="home-buddy-name">{profile.characterName}</h2>
          <p
            className={`character-state character-state-${view.character.state}`}
            role="status"
          >
            {t(STATE_KEYS[view.character.state])}
          </p>

          <div
            className="stage-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stagePercent}
            aria-labelledby="home-buddy-stage"
          >
            <span
              className="stage-progress-fill"
              style={{ width: `${stagePercent}%` }}
            />
          </div>
          <p id="home-buddy-stage" className="home-buddy-stage">
            {stageName} · {stageStatus}
          </p>

          <div className="home-meter">
            <span id="home-vitality-label" className="home-meter-label">
              {t("character.vitality")}
            </span>
            <div
              className="vitality-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={view.character.vitality}
              aria-labelledby="home-vitality-label"
            >
              <span
                className="vitality-fill"
                style={{ width: `${view.character.vitality}%` }}
              />
            </div>
          </div>

          <p className="home-quiet">
            <span>
              {t("home.streak")} ·{" "}
              <strong>
                {t("home.streakDays", { count: view.streakCount })}
              </strong>
            </span>
            <span>
              {t("home.careTokenCount", {
                count: view.careTokens,
                total: view.tokenProgress.cap,
              })}
            </span>
          </p>

          {showTokenHint ? (
            <p className="home-token-hint">
              {t("home.tokenHint", { count: sessionsToNextToken })}
            </p>
          ) : null}
        </div>
      </header>

      <SleepOverlay profile={profile} onProfileUpdated={onProfileUpdated} />

      {loadFailed ? (
        <p className="form-error" role="alert">
          {t("errors.generic")}
        </p>
      ) : null}

      <section
        className="home-session-card"
        aria-labelledby="home-session-title"
      >
        <h2 id="home-session-title" className="home-session-title">
          {view.caughtUp ? t("home.caughtUp") : t("home.todaySession")}
        </h2>

        {view.caughtUp ? (
          <>
            <p className="home-session-lead">{t("session.caughtUpBody")}</p>
            <div className="home-session-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate({ id: "words", tab: "collection" })}
              >
                {t("home.myWords")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate({ id: "topics" })}
              >
                {t("home.changeTopic")}
              </button>
            </div>
          </>
        ) : (
          <>
            <ul className="home-session-counts">
              {view.reviewsDue > 0 ? (
                <li className="home-session-count">
                  <span aria-hidden="true">🔁</span>{" "}
                  {t("session.reviewCount", { count: view.reviewsDue })}
                </li>
              ) : null}
              {view.newWords > 0 ? (
                <li className="home-session-count">
                  <span aria-hidden="true">✨</span>{" "}
                  {t("session.newWords", { count: view.newWords })}
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate({ id: "session" })}
            >
              {t("home.practice")}
            </button>
          </>
        )}
      </section>

      <nav className="home-cards" aria-label={t("home.shortcuts")}>
        {view.monthlyReviewDue ? (
          <button
            type="button"
            className="home-card home-review-card"
            onClick={() => navigate({ id: "review" })}
          >
            <span className="home-card-icon" aria-hidden="true">
              📅
            </span>
            <span className="home-card-title">{t("review.title")}</span>
            <span className="home-card-note">{t("home.reviewDue")}</span>
          </button>
        ) : null}

        <button
          type="button"
          className="home-card"
          onClick={() => navigate({ id: "words", tab: "collection" })}
        >
          <span className="home-card-icon" aria-hidden="true">
            📚
          </span>
          <span className="home-card-title">{t("home.myWords")}</span>
        </button>

        <button
          type="button"
          className="home-card"
          onClick={() => navigate({ id: "topics" })}
        >
          <span className="home-card-icon" aria-hidden="true">
            🗺️
          </span>
          <span className="home-card-title">{t("home.changeTopic")}</span>
        </button>

        <button
          type="button"
          className="home-card"
          onClick={() => navigate({ id: "settings" })}
        >
          <span className="home-card-icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="home-card-title">{t("home.settings")}</span>
        </button>
      </nav>

      <InstallPromptSlot />
    </section>
  )
}
