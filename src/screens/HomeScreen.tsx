import { useEffect, useRef } from "react"

import { AvatarStage } from "../components/AvatarStage"
import { Icon } from "../components/Icon"
import { InstallPromptSlot } from "../components/InstallPromptSlot"
import { SleepOverlay } from "../components/SleepOverlay"
import { topicTone } from "../components/tone"
import { UpdateStatusSlot } from "../components/UpdateStatusSlot"
import { useProfileProgress } from "../components/useProfileProgress"
import { config } from "../config"
import { getHomeContent, getTopic } from "../content"
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
  const topic =
    profile.currentTopicId === null
      ? undefined
      : getTopic(profile.currentTopicId)
  const topicTitle =
    topic === undefined
      ? t("settings.noTopic")
      : locale === "zh"
        ? topic.titleZh
        : topic.title

  const questTitle =
    view.practiceAgain > 0
      ? t("home.practiceAgainTitle")
      : view.caughtUp
        ? t("home.caughtUp")
        : t("home.todaySession")

  return (
    <section className="home-screen">
      <header className="topbar">
        <div className="topbar-copy">
          <span className="eyebrow">
            {t("home.welcomeBack")}, {profile.name}!
          </span>
          <h2 className="topbar-title">{t("home.adventure")}</h2>
        </div>

        <div className="top-stats">
          <span className="top-stat top-stat-streak">
            <Icon name="flame" />
            <b>{view.streakCount}</b>
            <small>{t("home.streak")}</small>
          </span>
          <span className="top-stat top-stat-token">
            <Icon name="heart" />
            <b>
              {view.careTokens}
              <span aria-hidden="true"> / </span>
              {config.careTokens.cap}
            </b>
            <small>{t("home.careTokens")}</small>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={t("home.settings")}
            onClick={() => navigate({ id: "settings" })}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <section className="hero" aria-labelledby="home-buddy-name">
        <div className="hero-pet">
          <AvatarStage
            avatar={avatar}
            stage={view.character.stage}
            alt={`${avatarName} — ${stageName}`}
            stageLabel={stageName}
            className="hero-stage"
          />
        </div>

        <div className="hero-copy">
          <span className="hero-tag">
            <Icon name="sparkle" size={15} />
            {stageName}
          </span>
          <h2 id="home-buddy-name" className="hero-name">
            {profile.characterName}
          </h2>
          <p className={`hero-state character-state-${view.character.state}`}>
            {t(STATE_KEYS[view.character.state])}
          </p>
          <p className="hero-grow">{t("home.grow")}</p>

          <div className="growth-label">
            <span>{stageStatus}</span>
            <b>{stagePercent}%</b>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stagePercent}
            aria-label={stageStatus}
          >
            <i style={{ width: `${stagePercent}%` }} />
          </div>

          <div className="hero-meter">
            <span id="home-vitality-label">{t("character.vitality")}</span>
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

          {showTokenHint ? (
            <p className="hero-hint">
              {t("home.tokenHint", { count: sessionsToNextToken })}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="hero-link"
          onClick={() => navigate({ id: "character" })}
        >
          {t("home.visitBuddy")} <Icon name="arrow" size={17} />
        </button>
      </section>

      <section className="topic-strip">
        <span className={`topic-mini ${topicTone(profile.currentTopicId)}`}>
          <span aria-hidden="true">{topic?.icon ?? "🗺️"}</span>
        </span>
        <div>
          <small>{t("home.currentWorld")}</small>
          <b>{topicTitle}</b>
        </div>
        <button type="button" onClick={() => navigate({ id: "topics" })}>
          {t("home.changeTopic")}
        </button>
      </section>

      <SleepOverlay profile={profile} onProfileUpdated={onProfileUpdated} />

      {loadFailed ? (
        <p className="form-error" role="alert">
          {t("errors.generic")}
        </p>
      ) : null}

      <UpdateStatusSlot />
      <InstallPromptSlot />

      <section className="today" aria-labelledby="home-session-title">
        <header>
          <div>
            <span className="eyebrow">{t("home.todayQuest")}</span>
            <h2>{t("home.little")}</h2>
          </div>
          {view.caughtUp ? null : (
            <span className="time-pill">
              {t("session.aboutMinutes", {
                count: view.estimatedMinutes,
              })}
            </span>
          )}
        </header>

        <article className="quest">
          <span className="quest-icon" aria-hidden="true">
            <Icon name="book" size={28} />
          </span>

          <div className="quest-copy">
            <h3 id="home-session-title">{questTitle}</h3>

            {view.practiceAgain > 0 ? (
              <>
                <p>
                  {t("home.practiceAgainBody", { count: view.practiceAgain })}
                </p>
                <div className="quest-chips">
                  <span>
                    {t("session.practiceAgainWords", {
                      count: view.practiceAgain,
                    })}
                  </span>
                  <span>{t("session.comprehensivePractice")}</span>
                </div>
              </>
            ) : view.caughtUp ? (
              <p>{t("session.caughtUpBody")}</p>
            ) : (
              <>
                <p>{t("session.questBody")}</p>
                <div className="quest-chips">
                  {view.reviewsDue > 0 ? (
                    <span>
                      {t("session.reviewCount", { count: view.reviewsDue })}
                    </span>
                  ) : null}
                  {view.newWords > 0 ? (
                    <span>
                      {t("session.newWords", { count: view.newWords })}
                    </span>
                  ) : null}
                  <span>{t("session.comprehensivePractice")}</span>
                </div>
              </>
            )}
          </div>

          {view.caughtUp && view.practiceAgain === 0 ? (
            <div className="quest-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => navigate({ id: "words", tab: "collection" })}
              >
                {t("home.myWords")}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => navigate({ id: "topics" })}
              >
                {t("home.changeTopic")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button primary"
              onClick={() => navigate({ id: "session" })}
            >
              <Icon name="play" size={19} />
              {view.practiceAgain > 0
                ? t("home.practiceAgain")
                : t("home.practice")}
            </button>
          )}
        </article>
      </section>

      <section className="feature-grid">
        <button
          type="button"
          className="feature-card"
          onClick={() => navigate({ id: "words", tab: "collection" })}
        >
          <i className="feature-icon feature-icon-words" aria-hidden="true">
            <Icon name="book" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("home.yourCollection")}</small>
            <b>{t("home.learnedCount", { count: view.learnedCount })}</b>
            <em>{t("home.seeWords")}</em>
          </span>
          <Icon name="arrow" />
        </button>

        <button
          type="button"
          className="feature-card feature-card-review"
          disabled={!view.monthlyReviewDue}
          onClick={() => {
            if (view.monthlyReviewDue) {
              navigate({ id: "review" })
            }
          }}
        >
          <i className="feature-icon feature-icon-review" aria-hidden="true">
            <Icon name="sparkle" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("review.title")}</small>
            <b>
              {view.monthlyReviewDue
                ? t("home.reviewReady")
                : t("home.reviewLocked")}
            </b>
            <em>
              {view.monthlyReviewDue ? t("home.reviewNote") : ""}
            </em>
          </span>
          <span className="feature-pill">
            {view.monthlyReviewDue ? t("home.reviewDueShort") : "—"}
          </span>
        </button>
      </section>
    </section>
  )
}
