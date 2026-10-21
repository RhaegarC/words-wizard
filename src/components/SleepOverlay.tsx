import {
  canFreeze,
  canQuickWake,
  deriveCharacterState,
} from "../domain/character"
import type { Profile } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

import { useCareAction } from "./useCareAction"

/**
 * PRD §7.2. An in-app nudge, never a blocker: practice stays one tap away and
 * both wake paths are visible. Feature 11 mounts this on the real Home; until
 * then the Home placeholder hosts it.
 */
export function SleepOverlay({
  profile,
  onProfileUpdated,
}: {
  profile: Profile
  onProfileUpdated: (profile: Profile) => void
}) {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const { pending, failed, run } = useCareAction(profile, onProfileUpdated)
  const now = Date.now()
  const character = deriveCharacterState(profile, now)

  if (character.state === "awake") {
    return null
  }

  const sleeping = character.state === "sleeping"
  const check = sleeping ? canQuickWake(profile, now) : canFreeze(profile, now)
  const action = sleeping ? "wake" : "freeze"
  const working = pending !== null

  return (
    <section
      className={`sleep-overlay sleep-overlay-${character.state}`}
      aria-labelledby="sleep-overlay-title"
    >
      <p className="sleep-overlay-emoji" aria-hidden="true">
        {sleeping ? "😴" : "🥱"}
      </p>
      <h2
        id="sleep-overlay-title"
        className="sleep-overlay-title"
        role="status"
      >
        {sleeping ? t("character.sleeping") : t("character.sleepy")}
      </h2>
      <p className="sleep-overlay-note">{t("character.neverLost")}</p>

      <div className="sleep-overlay-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate({ id: "session" })}
        >
          {t("character.practiceToWake")}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={working || !check.allowed}
          onClick={() => run(action)}
        >
          {working
            ? t("character.working")
            : sleeping
              ? t("character.useTokenToWake")
              : t("character.useTokenToFreeze")}
        </button>
      </div>

      <p className="sleep-overlay-note">
        {profile.careTokens > 0
          ? t("character.freeRevival")
          : t("character.noTokens")}
      </p>

      {failed ? (
        <p className="character-error" role="alert">
          {t("character.actionFailed")}
        </p>
      ) : null}
    </section>
  )
}
