import { useState, type CSSProperties, type FormEvent } from "react"

import { AvatarPortrait } from "../components/AvatarPortrait"
import { Brand } from "../components/Brand"
import { Icon } from "../components/Icon"
import { getAvatarSet } from "../content"
import { progressProvider } from "../api/provider"
import {
  buildNewProfile,
  validateAvatarId,
  validateCharacterName,
  type NameRejection,
} from "@/domain/firstRun"
import type { Profile } from "@shared/types"
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

  const selected = avatars.find((avatar) => avatar.id === avatarId) ?? null
  const selectedName = selected
    ? locale === "zh"
      ? selected.nameZh
      : selected.name
    : null

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
    <main className="creation">
      <header className="creation-top">
        <Brand />
        <span className="creation-tagline">{t("create.tagline")}</span>
      </header>

      <form className="creation-card" onSubmit={submit} noValidate>
        <div className="creation-copy">
          <span className="eyebrow">{t("create.eyebrow")}</span>
          <h1>{t("create.heading")}</h1>
          <p className="creation-lead">{t("create.subheading")}</p>

          <label className="name-field" htmlFor="character-name">
            <b>{t("create.nameLabel")}</b>
            <input
              id="character-name"
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
          </label>
          <p id="create-hint" className="field-hint">
            {t("create.nameHint")}
          </p>

          <div className="name-suggestions">
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

          {error !== null ? (
            <p id="create-error" className="form-error" role="alert">
              {t(ERROR_KEYS[error])}
            </p>
          ) : null}
        </div>

        <div className="avatar-builder">
          <div
            className="avatar-preview"
            style={selected ? { background: selected.pale } : undefined}
          >
            {selected ? (
              <AvatarPortrait avatar={selected} />
            ) : (
              <span className="avatar-preview-mark" aria-hidden="true">
                ?
              </span>
            )}
          </div>

          <fieldset className="avatar-fieldset">
            <legend className="field-label">{t("create.avatarLabel")}</legend>
            <div className="avatar-list">
              {avatars.map((avatar) => {
                const active = avatarId === avatar.id

                return (
                  <label
                    key={avatar.id}
                    className="avatar-choice"
                    data-selected={active || undefined}
                    style={
                      {
                        "--swatch": avatar.color,
                        "--pale": avatar.pale,
                      } as CSSProperties
                    }
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={avatar.id}
                      checked={active}
                      onChange={() => chooseAvatar(avatar.id)}
                    />
                    <AvatarPortrait avatar={avatar} />
                    <span className="avatar-choice-name">
                      {locale === "zh" ? avatar.nameZh : avatar.name}
                    </span>
                    {active ? (
                      <b className="avatar-check" aria-hidden="true">
                        <Icon name="check" size={13} />
                      </b>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <strong className="selected-name">{selectedName ?? " "}</strong>

          <button
            type="submit"
            className="button primary wide"
            disabled={saving}
          >
            {saving ? t("create.saving") : t("create.meet")}{" "}
            <Icon name="arrow" />
          </button>
        </div>
      </form>

      <p className="safe">
        <Icon name="shield" size={15} /> {t("create.safe")}
      </p>
    </main>
  )
}
