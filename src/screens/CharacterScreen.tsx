import { AvatarStage } from "../components/AvatarStage"
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
  const freeze = canFreeze(profile, now)
  const wake = canQuickWake(profile, now)
  const working = pending !== null

  return (
    <section className="character-screen">
      <AvatarStage
        avatar={avatar}
        stage={character.stage}
        alt={`${avatarName} — ${stageName}`}
        stageLabel={stageName}
      />

      <header className="character-identity">
        <h2 className="character-name">{profile.characterName}</h2>
        <p
          className={`character-state character-state-${character.state}`}
          role="status"
        >
          {t(STATE_KEYS[character.state])}
        </p>
      </header>

      <div className="character-block">
        <div className="character-inline">
          <span className="character-label">{t("character.vitality")}</span>
          <span className="character-value">{character.vitality} / 100</span>
        </div>
        <div
          className="vitality-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={character.vitality}
          aria-label={t("character.vitality")}
        >
          <span
            className="vitality-fill"
            style={{ width: `${character.vitality}%` }}
          />
        </div>
      </div>

      <div className="character-block">
        <div className="character-inline">
          <span className="character-label">{stageName}</span>
          <span className="character-value">{stageStatus}</span>
        </div>
        <div
          className="stage-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={stageStatus}
        >
          <span
            className="stage-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="character-block">
        <div className="character-inline">
          <span className="character-label">{t("character.careTokens")}</span>
          <span className="character-value">
            {profile.careTokens} / {config.careTokens.cap}
          </span>
        </div>
        <p className="character-hint">
          {profile.careTokens === 0
            ? t("character.noTokens")
            : t("character.freeRevival")}
        </p>
      </div>

      <div className="character-actions">
        {freeze.allowed ? (
          <>
            <button
              type="button"
              className="secondary-button"
              disabled={working}
              onClick={() => run("freeze")}
            >
              {pending === "freeze"
                ? t("character.working")
                : t("character.freeze")}
            </button>
            <p className="character-hint">{t("character.freezeHint")}</p>
          </>
        ) : null}

        {wake.allowed ? (
          <>
            <button
              type="button"
              className="primary-button"
              disabled={working}
              onClick={() => run("wake")}
            >
              {pending === "wake"
                ? t("character.working")
                : t("character.wake")}
            </button>
            <p className="character-hint">{t("character.wakeHint")}</p>
          </>
        ) : null}
      </div>

      {failed ? (
        <p className="character-error" role="alert">
          {t("character.actionFailed")}
        </p>
      ) : null}
    </section>
  )
}
