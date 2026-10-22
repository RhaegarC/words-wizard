import { useState, type FormEvent } from "react"

import { AvatarPortrait } from "../components/AvatarPortrait"
import { getAvatarSet } from "../content"
import { progressProvider } from "../db"
import {
  buildNewProfile,
  validateAvatarId,
  validateCharacterName,
  type NameRejection,
} from "../domain/firstRun"
import type { Profile } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"

const NAME_SUGGESTIONS = ["Mia", "Leo", "小雨", "Noah"]

type CreateError = NameRejection | "avatar" | "save"

const ERROR_KEYS: Record<CreateError, MessageKey> = {
  empty: "create.error.empty",
  "too-long": "create.error.tooLong",
  "invalid-character": "create.error.invalidCharacter",
  avatar: "create.error.avatar",
  save: "create.error.save",
}

/**
 * The only blocking gate in the product. One name field feeds both `name` and
 * `characterName` (PRD §7.0); the avatar must be one of the bundled ids.
 */
export function CreateScreen({
  onCreated,
}: {
  onCreated: (profile: Profile) => void
}) {
  const { locale, t } = useLocale()
  const avatars = getAvatarSet()
  const [name, setName] = useState("")
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [error, setError] = useState<CreateError | null>(null)
  const [saving, setSaving] = useState(false)

  const chooseAvatar = (id: string) => {
    setAvatarId(id)
    setError((current) => (current === "avatar" ? null : current))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving) {
      return
    }

    const nameResult = validateCharacterName(name)

    if (!nameResult.ok) {
      setError(nameResult.reason)
      return
    }

    const avatarResult = validateAvatarId(avatarId ?? "")

    if (!avatarResult.ok) {
      setError("avatar")
      return
    }

    setError(null)
    setSaving(true)

    const draft = buildNewProfile(
      { characterName: nameResult.value, avatar: avatarResult.avatar.id },
      Date.now(),
      locale,
    )

    void progressProvider
      .createProfile(draft)
      .then(onCreated)
      .catch((reason: unknown) => {
        console.error("[create] Could not save the profile", reason)
        setError("save")
        setSaving(false)
      })
  }

  return (
    <form className="create-form" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor="character-name">
        {t("create.nameLabel")}
      </label>
      <input
        id="character-name"
        className="name-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("create.namePlaceholder")}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        aria-invalid={error !== null && error !== "avatar" && error !== "save"}
        aria-describedby={
          error !== null ? "create-hint create-error" : "create-hint"
        }
      />
      <p id="create-hint" className="field-hint">
        {t("create.nameHint")}
      </p>

      <div className="suggestion-row">
        <span className="field-hint">{t("create.suggestionsLabel")}</span>
        {NAME_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="suggestion-chip"
            onClick={() => setName(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <fieldset className="avatar-fieldset">
        <legend className="field-label">{t("create.avatarLabel")}</legend>
        <div className="avatar-grid">
          {avatars.map((avatar) => {
            const selected = avatarId === avatar.id

            return (
              <label
                key={avatar.id}
                className="avatar-option"
                data-selected={selected || undefined}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={avatar.id}
                  checked={selected}
                  onChange={() => chooseAvatar(avatar.id)}
                />
                <AvatarPortrait avatar={avatar} />
                <span className="avatar-name">
                  {locale === "zh" ? avatar.nameZh : avatar.name}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {error !== null ? (
        <p id="create-error" className="form-error" role="alert">
          {t(ERROR_KEYS[error])}
        </p>
      ) : null}

      <button type="submit" className="primary-button" disabled={saving}>
        {saving ? t("create.saving") : t("create.submit")}
      </button>
    </form>
  )
}
