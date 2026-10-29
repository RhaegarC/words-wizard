import { AvatarStage } from "../components/AvatarStage"
import { Icon } from "../components/Icon"
import { useCareAction } from "../components/useCareAction"
import { config } from "../config"
import { getAvatarSet } from "../content"
import {
  canFreeze,
  canQuickWake,
  deriveCharacterState,
} from "../domain/character"
import { stageProgress } from "../domain/progression"
import type { CharacterCondition, Profile } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"
import { stageMessageKey } from "../i18n/stages"

const STATE_KEYS: Record<CharacterCondition, MessageKey> = {
  awake: "character.awake",
  sleepy: "character.sleepy",
  sleeping: "character.sleeping",
}

/**
 * PRD §7.1–§7.5. Everything on this screen is derived from the profile at
 * render time; the only writes are the two Care Token spends.
 */
export function CharacterScreen({
  profile,
  onProfileUpdated,
}: {
  profile: Profile
  onProfileUpdated: (profile: Profile) => void
}) {
  const { locale, t } = useLocale()
  const { pending, failed, run } = useCareAction(profile, onProfileUpdated)
  const now = Date.now()
  const character = deriveCharacterState(profile, now)
  const progress = stageProgress(profile.xp)
  const avatar = getAvatarSet().find((entry) => entry.id === profile.avatar)
  const avatarName = avatar
    ? locale === "zh"
      ? avatar.nameZh
      : avatar.name
    : profile.characterName
  const stageName = t(stageMessageKey(character.stage))
  const percent = Math.round(progress.fraction * 100)
  // PRD §7.2: XP is internal and appears only as stage progress. The child
  // sees a filling bar and the next stage's name, never a raw total.
  const stageStatus =
    progress.nextStage === null
      ? t("character.maxStage")
      : t("character.workingTowards", {
          next: t(stageMessageKey(progress.nextStage)),
        })
  const nextStageName =
    progress.nextStage === null
      ? t("character.maxStage")
      : t(stageMessageKey(progress.nextStage))
  const freeze = canFreeze(profile, now)
  const wake = canQuickWake(profile, now)
  const working = pending !== null

  return (
    <section className="buddy">
      <div className={`buddy-art ${character.state}`}>
        <AvatarStage
          avatar={avatar}
          stage={character.stage}
          alt={`${avatarName} — ${stageName}`}
          stageLabel={stageName}
          className="buddy-stage"
        />
        {character.state === "awake" ? null : (
          <span className="sleep-mark">
            <Icon name="moon" />{" "}
            {character.state === "sleeping" ? "Z z z" : "…"}
          </span>
        )}
      </div>

      <div className="buddy-copy">
        <span className="eyebrow">{t("character.eyebrow")}</span>
        <h2 className="buddy-name">{profile.characterName}</h2>
        <p className="buddy-meta">
          {stageName} · {avatarName}
        </p>
        <p className={`buddy-state character-state-${character.state}`} role="status">
          {t(STATE_KEYS[character.state])}
        </p>

        <article className="buddy-card">
          <header>
            <span>{t("character.nextStage")}</span>
            <b>{nextStageName}</b>
          </header>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={stageStatus}
          >
            <i style={{ width: `${percent}%` }} />
          </div>
          <small>{stageStatus}</small>
        </article>

        <div className="vitality">
          <header>
            <span>{t("character.vitality")}</span>
            <b>
              {character.state === "awake"
                ? t("character.vitalityAwake")
                : character.state === "sleepy"
                  ? t("character.vitalitySleepy")
                  : t("character.vitalitySleeping")}
            </b>
          </header>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={character.vitality}
            aria-label={t("character.vitality")}
          >
            <i style={{ width: `${character.vitality}%` }} />
          </div>
        </div>

        <aside className="buddy-stats">
          <div className="buddy-stat buddy-stat-tokens">
            <Icon name="heart" />
            <b>
              {profile.careTokens} / {config.careTokens.cap}
            </b>
            <small>
              {t("character.tokensProgress", {
                count: profile.sessionsSinceLastToken,
                total: config.careTokens.sessionsPerToken,
              })}
            </small>
          </div>
          <div className="buddy-stat buddy-stat-streak">
            <Icon name="flame" />
            <b>{t("home.streakDays", { count: profile.streakCount })}</b>
            <small>
              {t("character.bestStreak", { count: profile.bestStreak })}
            </small>
          </div>
        </aside>

        <div className="care-actions">
          {freeze.allowed ? (
            <button
              type="button"
              className="button secondary"
              disabled={working}
              onClick={() => run("freeze")}
            >
              <Icon name="shield" size={17} />{" "}
              {pending === "freeze" ? t("character.working") : t("character.freeze")}
            </button>
          ) : null}

          {wake.allowed ? (
            <button
              type="button"
              className="button primary"
              disabled={working}
              onClick={() => run("wake")}
            >
              {pending === "wake" ? t("character.working") : t("character.wake")}
            </button>
          ) : null}
        </div>

        {freeze.allowed ? (
          <p className="buddy-hint">{t("character.freezeHint")}</p>
        ) : null}
        {wake.allowed ? (
          <p className="buddy-hint">{t("character.wakeHint")}</p>
        ) : null}
        <p className="buddy-hint">
          {profile.careTokens === 0
            ? t("character.noTokens")
            : t("character.freeRevival")}
        </p>

        {failed ? (
          <p className="character-error" role="alert">
            {t("character.actionFailed")}
          </p>
        ) : null}
      </div>
    </section>
  )
}
