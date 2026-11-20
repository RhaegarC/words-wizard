import { useEffect, useState } from "react"

import type { TopicExam } from "@shared/exam"
import { deriveTopicStatus } from "@shared/topicStatus"
import type { Profile } from "@shared/types"
import { progressProvider } from "../api/provider"
import { Icon } from "../components/Icon"
import { useIntroductions } from "../components/useTopicStatus"
import { getPacksByTopic } from "../content"
import { TOPIC_STATUS_KEYS } from "../domain/topicStatus"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * The Practice nav's front door: a daily quest, free practice, or the topic
 * exam. The exam card follows the Worker's gate; it stays disabled until every
 * word in the current topic has been introduced.
 */
export function PracticeHubScreen({ profile }: { profile: Profile }) {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const [exam, setExam] = useState<TopicExam | null>(null)
  const [examError, setExamError] = useState(false)
  const { introductions, failed: introductionsFailed } = useIntroductions(
    profile.id,
  )

  useEffect(() => {
    if (profile.currentTopicId === null) {
      return
    }

    let active = true

    progressProvider
      .getExam(profile.currentTopicId)
      .then((next) => {
        if (active) {
          setExam(next)
          setExamError(false)
        }
      })
      .catch((error: unknown) => {
        console.error("[exam] Could not read the exam gate", error)

        if (active) {
          setExamError(true)
        }
      })

    return () => {
      active = false
    }
  }, [profile.currentTopicId])

  const unlocked = exam?.gate.unlocked === true
  const status =
    profile.currentTopicId !== null &&
    introductions !== null &&
    !introductionsFailed &&
    !examError &&
    exam !== null
      ? deriveTopicStatus({
          topicId: profile.currentTopicId,
          packs: getPacksByTopic(profile.currentTopicId),
          introductions,
          exams:
            exam.state === null
              ? []
              : [
                  {
                    topicId: profile.currentTopicId,
                    completedAt: exam.state.completedAt,
                  },
                ],
        })
      : null
  const examHint =
    profile.currentTopicId === null
      ? t("exam.locked")
      : examError
        ? t("exam.error")
        : exam === null
          ? t("common.loading")
          : t("exam.gate", {
              introduced: exam.gate.introduced,
              total: exam.gate.total,
            })

  return (
    <section className="word-page">
      <header>
        <div>
          <span className="eyebrow">{t("session.questEyebrow")}</span>
          <h2>{t("session.hub.title")}</h2>
          <p>{t("session.hub.lead")}</p>
        </div>
      </header>

      <div className="feature-grid">
        <button
          type="button"
          className="feature-card"
          onClick={() => navigate({ id: "session" })}
        >
          <i className="feature-icon feature-icon-words" aria-hidden="true">
            <Icon name="sparkle" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("session.hub.dailyTitle")}</small>
            <b>{t("session.hub.dailyBody")}</b>
          </span>
          <Icon name="arrow" />
        </button>

        <button
          type="button"
          className="feature-card"
          onClick={() => navigate({ id: "session-free" })}
        >
          <i className="feature-icon feature-icon-words" aria-hidden="true">
            <Icon name="book" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("session.hub.freeTitle")}</small>
            <b>{t("session.hub.freeBody")}</b>
          </span>
          <Icon name="arrow" />
        </button>

        <button
          type="button"
          className="feature-card"
          disabled={!unlocked}
          onClick={() => navigate({ id: "session-exam" })}
        >
          <i className="feature-icon feature-icon-review" aria-hidden="true">
            <Icon name="shield" size={28} />
          </i>
          <span className="feature-copy">
            <small>{t("session.hub.examTitle")}</small>
            <b>{t("session.hub.examBody")}</b>
            {status === null ? null : (
              <span className="topic-status" data-status={status}>
                {t(TOPIC_STATUS_KEYS[status])}
              </span>
            )}
            <em>{examHint}</em>
          </span>
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  )
}
