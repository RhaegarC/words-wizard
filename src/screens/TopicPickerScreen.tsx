import { useState } from "react"

import { getPacksByTopic, getTopics } from "../content"
import { progressProvider } from "../db"
import { resolveTopicChoice } from "../domain/firstRun"
import type { Profile } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"

/**
 * All five topics are open from the first run. The mastery count is zero until
 * feature 09 starts committing progress; the picker shows the pack count now
 * so the size of a topic is visible.
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
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const topics = getTopics()

  const choose = (topicId: string) => {
    if (pendingId !== null || profile.id === undefined) {
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
    <section className="topic-picker">
      {fromSettings ? (
        <p className="settings-copy">{t("settings.changeTopicHint")}</p>
      ) : null}

      <ul className="topic-grid">
        {topics.map((topic) => {
          const packCount = getPacksByTopic(topic.id).length
          const selected = profile.currentTopicId === topic.id

          return (
            <li key={topic.id}>
              <button
                type="button"
                className="topic-card"
                data-selected={selected || undefined}
                disabled={pendingId !== null}
                aria-pressed={selected}
                onClick={() => choose(topic.id)}
              >
                <span className="topic-icon" aria-hidden="true">
                  {topic.icon}
                </span>
                <span className="topic-title">
                  {locale === "zh" ? topic.titleZh : topic.title}
                </span>
                <span className="topic-title-alt">
                  {locale === "zh" ? topic.title : topic.titleZh}
                </span>
                <span className="topic-description">
                  {locale === "zh" ? topic.descriptionZh : topic.description}
                </span>
                <span className="topic-meta">
                  {t("topics.packCount", { count: packCount })} ·{" "}
                  {t("topics.mastered", { count: 0 })}
                </span>
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
    </section>
  )
}
