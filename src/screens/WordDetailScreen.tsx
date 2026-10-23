import { useState } from "react"

import { Icon } from "../components/Icon"
import { WordArtwork } from "../components/WordArtwork"
import { useProfileProgress } from "../components/useProfileProgress"
import { getTopic, getWord } from "../content"
import { buildWordDetail } from "../domain/myWords"
import type { Profile, Topic } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { hasEnglishVoice, speak } from "../speech"

const STATUS_KEYS = {
  new: "words.newStatus",
  learning: "words.learning",
  mastered: "words.mastered",
} as const

/**
 * PRD §7.3. One detail screen behind both tabs. Meaning and definition carry
 * both languages; status and strength come from `buildWordDetail`.
 */
export function WordDetailScreen({
  profile,
  wordId,
}: {
  profile: Profile
  wordId: string
}) {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { progress, failed } = useProfileProgress(profile.id)
  const [speechFailed, setSpeechFailed] = useState(false)
  const word = getWord(wordId)

  if (word === undefined) {
    return (
      <section className="word-detail">
        <p className="words-empty-copy">{t("words.notFound")}</p>
      </section>
    )
  }

  if (progress === null) {
    return (
      <section className="word-detail">
        <p role="status" className="words-loading">
          {t("common.loading")}
        </p>
      </section>
    )
  }

  if (failed) {
    return (
      <section className="word-detail">
        <p className="form-error" role="alert">
          {t("errors.generic")}
        </p>
      </section>
    )
  }

  const row = progress.find((entry) => entry.wordId === wordId)
  const detail = buildWordDetail(word, row)
  const percent = Math.round(detail.strength * 100)
  const speechAvailable = hasEnglishVoice()
  const topics = detail.topicIds
    .map((topicId) => getTopic(topicId))
    .filter((topic): topic is Topic => topic !== undefined)

  return (
    <section className="word-detail">
      <button
        type="button"
        className="back-action"
        onClick={() => navigate({ id: "words", tab: "collection" })}
      >
        ← {t("words.backToWords")}
      </button>

      <div className="detail-layout">
        <WordArtwork word={word} className="detail-art" alt={detail.text} />

        <div className="detail-copy">
          <span className={`status-badge ${detail.status}`}>
            {t(STATUS_KEYS[detail.status])}
          </span>

          <div className="word-heading">
            <h2>{detail.text}</h2>
            <strong lang="zh">{detail.meaningZh}</strong>

            {speechAvailable ? (
              <button
                type="button"
                className="word-hear"
                aria-label={t("words.hearWord")}
                onClick={() => setSpeechFailed(!speak(detail.text))}
              >
                <Icon name="volume" />
              </button>
            ) : null}
          </div>

          <p className="phonetic">
            {detail.phonetic} · {word.partOfSpeech}
          </p>

          {!speechAvailable || speechFailed ? (
            <p className="detail-speech-note" role="status">
              {t("errors.speechUnavailable")}
            </p>
          ) : null}

          <div className="bilingual-definition">
            <p>
              <b>EN</b>
              {detail.definitionEn}
            </p>
            <p>
              <b>中文</b>
              {detail.definitionZh}
            </p>
          </div>

          <div className="examples">
            <p lang="en">“{detail.example.en}”</p>
            <p lang="zh">{detail.example.zh}</p>
          </div>

          <div className="detail-strength">
            <span>{t("words.strength")}</span>
            <b>{percent}%</b>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={t("words.strength")}
            >
              <i style={{ width: `${percent}%` }} />
            </div>
          </div>

          {topics.length > 0 ? (
            <div className="detail-topics">
              <span>{t("words.topicLabel")}</span>
              <ul>
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <span aria-hidden="true">{topic.icon}</span>{" "}
                    {locale === "zh" ? topic.titleZh : topic.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
