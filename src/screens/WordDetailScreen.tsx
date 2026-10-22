import { useState } from "react"

import { WordArtwork } from "../components/WordArtwork"
import { useProfileProgress } from "../components/useProfileProgress"
import { getTopic, getWord } from "../content"
import { buildWordDetail } from "../domain/myWords"
import type { Profile, Topic } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import { hasEnglishVoice, speak } from "../speech"

const STATUS_KEYS = {
  new: "words.newStatus",
  learning: "words.learning",
  mastered: "words.mastered",
} as const

/**
 * PRD §7.3. One detail screen behind both tabs. The meaning and definition are
 * always English; status and strength come from `buildWordDetail`.
 */
export function WordDetailScreen({
  profile,
  wordId,
}: {
  profile: Profile
  wordId: string
}) {
  const { locale, t } = useLocale()
  const { progress, failed } = useProfileProgress(profile.id)
  const [speechFailed, setSpeechFailed] = useState(false)
  const word = getWord(wordId)

  if (word === undefined) {
    return (
      <section className="word-detail-screen">
        <p className="words-empty-copy">{t("words.notFound")}</p>
      </section>
    )
  }

  if (progress === null) {
    return (
      <section className="word-detail-screen">
        <p role="status" className="words-loading">
          {t("common.loading")}
        </p>
      </section>
    )
  }

  if (failed) {
    return (
      <section className="word-detail-screen">
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
    <section className="word-detail-screen">
      <header className="word-detail-head">
        <div className="word-detail-title">
          <h2 className="word-detail-word">{detail.text}</h2>
          <p className="word-detail-phonetic">{detail.phonetic}</p>
        </div>
        <span className={`words-badge words-badge-${detail.status}`}>
          {t(STATUS_KEYS[detail.status])}
        </span>
      </header>

      <WordArtwork word={word} className="word-detail-art" alt={detail.text} />

      {speechAvailable ? (
        <button
          type="button"
          className="secondary-button word-detail-hear"
          onClick={() => setSpeechFailed(!speak(detail.text))}
        >
          <span aria-hidden="true">🔊</span> {t("words.hearWord")}
        </button>
      ) : null}

      {!speechAvailable || speechFailed ? (
        <p className="word-detail-speech-note" role="status">
          {t("errors.speechUnavailable")}
        </p>
      ) : null}

      <dl className="word-detail-meanings">
        <div>
          <dt>{t("words.meaningLabel")}</dt>
          <dd>{detail.meaning}</dd>
        </div>
        <div>
          <dt>{t("words.definitionLabel")}</dt>
          <dd>{detail.definition}</dd>
        </div>
      </dl>

      <section
        className="word-detail-example"
        aria-labelledby="word-detail-example-title"
      >
        <h3 id="word-detail-example-title">{t("words.example")}</h3>
        <p lang="en">{detail.example.en}</p>
        <p lang="zh">{detail.example.zh}</p>
      </section>

      <div className="word-detail-strength">
        <span className="word-detail-label">{t("words.strength")}</span>
        <div
          className="words-strength word-detail-strength-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={t("words.strength")}
        >
          <span
            className="words-strength-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {topics.length > 0 ? (
        <div className="word-detail-topics">
          <span className="word-detail-label">{t("words.topicLabel")}</span>
          <ul>
            {topics.map((topic) => (
              <li key={topic.id} className="word-detail-topic">
                <span aria-hidden="true">{topic.icon}</span>{" "}
                {locale === "zh" ? topic.titleZh : topic.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
