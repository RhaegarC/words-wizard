import type { Profile } from "@shared/types"

import { avatarInitials, avatarUrl } from "../avatar"
import { useAuth } from "../auth/AuthProvider"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * Feature 38. The one profile entry: the uploaded photo when present, otherwise
 * the name initial. The shell's top bar uses the chip variant; Home uses the
 * compact one.
 */
export function ProfileLink({
  profile,
  variant = "compact",
  active = false,
}: {
  profile: Profile
  variant?: "compact" | "chip"
  active?: boolean
}) {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const auth = useAuth()
  const chip = variant === "chip"
  const label = t("common.screen.settings")
  const photo =
    auth.config === null
      ? null
      : avatarUrl(auth.config.avatarBaseUrl, profile.userAvatarKey)

  return (
    <button
      type="button"
      className={chip ? "profile-link user-chip" : "profile-link"}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={() => navigate({ id: "settings" })}
    >
      {photo !== null ? (
        <img
          className={chip ? "user-chip-photo" : "profile-link-photo"}
          src={photo}
          alt=""
        />
      ) : (
        <span
          className={
            chip ? "user-chip-initials" : "profile-link-initials"
          }
          aria-hidden="true"
        >
          {avatarInitials(profile.name)}
        </span>
      )}
      {chip ? <span className="user-chip-name">{profile.name}</span> : null}
    </button>
  )
}
