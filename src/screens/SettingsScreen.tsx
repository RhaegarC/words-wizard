import { useState, type FormEvent } from "react"

import { AvatarPortrait } from "../components/AvatarPortrait"
import { Icon } from "../components/Icon"
import { SettingsDiagnostics } from "../components/SettingsDiagnostics"
import { UpdateStatusSlot } from "../components/UpdateStatusSlot"
import { getAvatarSet, getContentMeta, getTopic } from "../content"
import { progressProvider } from "../db"
import { DEVICE_KEYS } from "../db/device"
import {
  APP_VERSION,
  buildExport,
  EXPORT_SCHEMA_VERSION,
  exportFileName,
} from "../domain/export"
import {
  buildRecustomizePatch,
  type RecustomizeError,
} from "../domain/settings"
import type { Device, Profile } from "../domain/types"
import { downloadJson } from "../download"
import { useLocale } from "../i18n/LocaleProvider"
import type { Locale } from "../i18n/locale"
import type { MessageKey } from "../i18n/messages"
import { useRouter } from "../router/RouterContext"

const ERROR_KEYS: Record<RecustomizeError, MessageKey> = {
  empty: "create.error.empty",
  "too-long": "create.error.tooLong",
  "invalid-character": "create.error.invalidCharacter",
  avatar: "create.error.avatar",
}

type SaveError = RecustomizeError | "save"
type LocaleChoice = { id: Locale; label: string }

const LOCALE_CHOICES: readonly LocaleChoice[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
]

/**
 * Feature 14. Settings is deliberately additive: it edits the profile, opens
 * the existing topic picker, downloads a backup, and reports local facts. There
 * is no delete, reset, import, account, or network call.
 */
export function SettingsScreen({
  profile,
  onProfileUpdated,
}: {
  profile: Profile
  onProfileUpdated: (profile: Profile) => void
}) {
  const { locale, setLocale, t } = useLocale()
  const { navigate } = useRouter()
  const avatars = getAvatarSet()
  const [name, setName] = useState(profile.characterName)
  const [avatarId, setAvatarId] = useState(profile.avatar)
  const [saveError, setSaveError] = useState<SaveError | null>(null)
  const [saving, setSaving] = useState(false)
  const [localeFailed, setLocaleFailed] = useState(false)
  const [localeSaving, setLocaleSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

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

  const chooseLocale = (next: Locale) => {
    if (next === locale || localeSaving) {
      return
    }

    const previous = locale

    setLocaleFailed(false)
    setLocaleSaving(true)
    setLocale(next)

    if (profile.id === undefined) {
      setLocaleSaving(false)
      return
    }

    void progressProvider
      .updateProfile(profile.id, { locale: next })
      .then(() => onProfileUpdated({ ...profile, locale: next }))
      .catch((reason: unknown) => {
        console.error("[settings] Could not save the language", reason)
        setLocale(previous)
        setLocaleFailed(true)
      })
      .finally(() => setLocaleSaving(false))
  }

  const saveCharacter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving) {
      return
    }

    const result = buildRecustomizePatch({ characterName: name, avatar: avatarId })

    if (!result.ok) {
      setSaveError(result.reason)
      return
    }

    if (profile.id === undefined) {
      setSaveError("save")
      return
    }

    setSaveError(null)
    setSaving(true)

    void progressProvider
      .updateProfile(profile.id, result.patch)
      .then(() => {
        onProfileUpdated({ ...profile, ...result.patch })
        navigate({ id: "home" })
      })
      .catch((reason: unknown) => {
        console.error("[settings] Could not save the buddy", reason)
        setSaveError("save")
      })
      .finally(() => setSaving(false))
  }

  const exportBackup = () => {
    if (profile.id === undefined || exporting) {
      return
    }

    const now = Date.now()

    setExporting(true)
    setExportFailed(false)

    void Promise.all([
      progressProvider.getAllProgress(profile.id),
      progressProvider.getMetrics(profile.id),
      readDeviceRows(),
    ])
      .then(([progress, metrics, device]) => {
        const payload = buildExport({
          profile,
          progress,
          metrics,
          device,
          meta: {
            schemaVersion: EXPORT_SCHEMA_VERSION,
            contentVersion: getContentMeta().contentVersion,
            appVersion: APP_VERSION,
          },
          now,
        })

        downloadJson(exportFileName(now), payload)
      })
      .catch((reason: unknown) => {
        console.error("[settings] Could not prepare the backup", reason)
        setExportFailed(true)
      })
      .finally(() => setExporting(false))
  }

  return (
    <section className="settings-page">
      <span className="eyebrow">{t("settings.eyebrow")}</span>
      <h2 className="settings-title">{t("settings.heading")}</h2>

      <UpdateStatusSlot />

      <div className="settings-grid">
        <article className="settings-card" aria-labelledby="settings-language">
          <header>
            <Icon name="globe" />
            <div>
              <h3 id="settings-language">{t("settings.language")}</h3>
              <p>{t("settings.languageHint")}</p>
            </div>
          </header>

          <div
            className="language-toggle"
            role="group"
            aria-labelledby="settings-language"
          >
            {LOCALE_CHOICES.map((choice) => {
              const selected = locale === choice.id

              return (
                <button
                  key={choice.id}
                  type="button"
                  className={selected ? "active" : undefined}
                  aria-pressed={selected}
                  disabled={localeSaving}
                  onClick={() => chooseLocale(choice.id)}
                >
                  {choice.label}
                </button>
              )
            })}
          </div>

          {localeFailed ? (
            <p role="alert" className="form-error">
              {t("settings.localeError")}
            </p>
          ) : null}
        </article>

        <form
          className="settings-card"
          aria-labelledby="settings-buddy"
          onSubmit={saveCharacter}
          noValidate
        >
          <header>
            <Icon name="user" />
            <div>
              <h3 id="settings-buddy">{t("settings.customise")}</h3>
              <p>{t("settings.customiseHint")}</p>
            </div>
          </header>

          <label className="setting-input" htmlFor="settings-name">
            <span>{t("create.nameLabel")}</span>
            <input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("create.namePlaceholder")}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              aria-invalid={
                saveError !== null &&
                saveError !== "avatar" &&
                saveError !== "save"
              }
              aria-describedby={
                saveError !== null
                  ? "settings-name-hint settings-save-error"
                  : "settings-name-hint"
              }
            />
          </label>
          <p id="settings-name-hint" className="field-hint">
            {t("create.nameHint")}
          </p>

          <fieldset className="avatar-fieldset">
            <legend className="field-label">{t("create.avatarLabel")}</legend>
            <div className="settings-avatars">
              {avatars.map((avatar) => {
                const selected = avatarId === avatar.id

                return (
                  <label
                    key={avatar.id}
                    className="settings-avatar"
                    data-selected={selected || undefined}
                    style={{ background: avatar.pale }}
                  >
                    <input
                      type="radio"
                      name="settings-avatar"
                      value={avatar.id}
                      checked={selected}
                      onChange={() => setAvatarId(avatar.id)}
                    />
                    <AvatarPortrait avatar={avatar} />
                    <span className="sr-only">
                      {locale === "zh" ? avatar.nameZh : avatar.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {saveError !== null ? (
            <p id="settings-save-error" className="form-error" role="alert">
              {saveError === "save"
                ? t("settings.saveError")
                : t(ERROR_KEYS[saveError])}
            </p>
          ) : null}

          <button type="submit" className="button primary" disabled={saving}>
            {saving ? t("create.saving") : t("settings.save")}
          </button>
        </form>

        <article className="settings-card" aria-labelledby="settings-topic">
          <header>
            <Icon name="image" />
            <div>
              <h3 id="settings-topic">{t("settings.changeTopic")}</h3>
              <p>{t("settings.currentTopic", { topic: topicTitle })}</p>
            </div>
          </header>

          <p className="settings-copy">{t("settings.changeTopicHint")}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate({ id: "topics", from: "settings" })}
          >
            {t("settings.changeTopic")}
          </button>
        </article>

        <article className="settings-card" aria-labelledby="settings-backup">
          <header>
            <Icon name="download" />
            <div>
              <h3 id="settings-backup">{t("settings.export")}</h3>
              <p>{t("settings.exportHint")}</p>
            </div>
          </header>

          <button
            type="button"
            className="button primary"
            disabled={exporting}
            onClick={exportBackup}
          >
            <Icon name="download" size={17} />{" "}
            {exporting ? t("settings.exporting") : t("settings.export")}
          </button>

          {exportFailed ? (
            <p role="alert" className="form-error">
              {t("settings.exportError")}
            </p>
          ) : null}
        </article>

        <SettingsDiagnostics profileId={profile.id} />

        <article className="settings-card" aria-labelledby="settings-about">
          <header>
            <Icon name="shield" />
            <div>
              <h3 id="settings-about">{t("settings.about")}</h3>
              <p>{t("settings.aboutBody")}</p>
            </div>
          </header>

          <dl className="settings-facts">
            <div>
              <dt>{t("settings.appVersion")}</dt>
              <dd>{APP_VERSION}</dd>
            </div>
            <div>
              <dt>{t("settings.contentVersion")}</dt>
              <dd>{getContentMeta().contentVersion}</dd>
            </div>
          </dl>

          <a
            className="settings-link"
            href="https://github.com/RhaegarC/words-wizard/blob/master/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            {t("settings.licence")}
          </a>
        </article>
      </div>
    </section>
  )
}

/** Known device keys, read as plain rows for the backup builder. */
async function readDeviceRows(): Promise<Device[]> {
  return Promise.all(
    Object.values(DEVICE_KEYS).map(async (key) => ({
      key,
      value: await progressProvider.getDevice(key),
    })),
  )
}
