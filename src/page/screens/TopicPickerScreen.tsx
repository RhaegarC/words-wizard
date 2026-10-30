import { useState } from "react"

import { Brand } from "../components/Brand"
import { Icon } from "../components/Icon"
import { topicTone } from "../components/tone"
import { getPacksByTopic, getTopics } from "../content"
import { progressProvider } from "../api/provider"
import { resolveTopicChoice } from "@/domain/firstRun"
import type { Profile } from "@shared/types"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * All five topics are open from the first run. Arriving from Settings means
 * there is somewhere to go back to; a first run continues into the app.
 */
export function TopicPickerScreen({
  profile,
  fromSettings = false,
  onChosen,
}: {
  profile: Profile
  /** True when Settings opened the picker, which changes where back goes. */
  fromSettings?: boolean
  onChosen: (profile: Profile) => void
}) {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const topics = getTopics()

  const choose = (topicId: string) => {
    if (pendingId !== null) {
      return
    }

    const patch = resolveTopicChoice(topicId)

    if (!patch) {
      setFailed(true)
      return
    }

    setPendingId(topicId)
    setFailed(false)

    void progressProvider
      .updateProfile(profile.id, patch)
      .then(() => onChosen({ ...profile, ...patch }))
      .catch((reason: unknown) => {
        console.error("[topics] Could not save the topic", reason)
        setFailed(true)
        setPendingId(null)
      })
  }

  return (
    <main className="setup-page topic-setup">
      <Brand />

      {fromSettings ? (
        <button
          type="button"
          className="back-action"
          onClick={() => navigate({ id: "settings" })}
        >
          ← {t("common.back")}
        </button>
      ) : null}

      <header className="setup-head">
        <span className="eyebrow">{t("topics.eyebrow")}</span>
        <h1>{t("topics.title")}</h1>
        <p>{t("topics.subtitle")}</p>
      </header>

      <ul className="topic-grid">
        {topics.map((topic, index) => {
          const packCount = getPacksByTopic(topic.id).length
          const selected = profile.currentTopicId === topic.id

          return (
            <li key={topic.id}>
              <button
                type="button"
                className={`topic-card ${topicTone(topic.id)}`}
                data-selected={selected || undefined}
                disabled={pendingId !== null}
                aria-pressed={selected}
                onClick={() => choose(topic.id)}
              >
                <span className="topic-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="topic-art" aria-hidden="true">
                  {topic.icon}
                </span>
                <strong>{locale === "zh" ? topic.titleZh : topic.title}</strong>
                <b>{locale === "zh" ? topic.title : topic.titleZh}</b>
                <p>
                  {locale === "zh" ? topic.descriptionZh : topic.description}
                </p>
                <span className="topic-meta">
                  {selected
                    ? t("topics.selected")
                    : t("topics.packCount", { count: packCount })}
                </span>
                <i className="topic-arrow">
                  <Icon name="arrow" size={17} />
                </i>
              </button>
            </li>
          )
        })}
      </ul>

      {failed ? (
        <p className="form-error" role="alert">
          {t("errors.generic")}
        </p>
      ) : null}
    </main>
  )
}
