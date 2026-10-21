import { useEffect, useRef, useState, type ReactNode } from "react"

import { WordArtwork } from "../components/WordArtwork"
import { useProfileProgress } from "../components/useProfileProgress"
import { getAllWords, getTopics } from "../content"
import { progressProvider } from "../db"
import { METRIC_NAMES } from "../db/metrics"
import {
  applyFilters,
  countByStatus,
  countByTopic,
  DEFAULT_FILTERS,
  getCollected,
  getMastered,
  hasActiveFilters,
  type CollectedWord,
  type StatusFilter,
  type WordFilters,
} from "../domain/myWords"
import type { Locale, Profile } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import type { WordsTab } from "../router/routes"

const WORDS = getAllWords()
const TOPICS = getTopics()
const TOPICS_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]))

const STATUS_KEYS = {
  new: "words.newStatus",
  learning: "words.learning",
  mastered: "words.mastered",
} as const

/**
 * PRD §7.3, Appendix A.3. One destination, two tabs bound to `?tab=`.
 * Selectors do the joining, filtering, and counting; this screen only renders
 * their output and records that a tab was opened.
 */
export function WordsScreen({
  profile,
  tab,
}: {
  profile: Profile
  tab: WordsTab
}) {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { progress, failed } = useProfileProgress(profile.id)
  const [filters, setFilters] = useState<WordFilters>(DEFAULT_FILTERS)
  const listRef = useRef<HTMLUListElement>(null)
  // StrictMode runs the effect twice; the ref keeps the metric at one per open.
  const recordedTab = useRef<WordsTab | null>(null)

  useEffect(() => {
    if (profile.id === undefined || recordedTab.current === tab) {
      return
    }

    recordedTab.current = tab

    const metric =
      tab === "collection"
        ? METRIC_NAMES.collectionOpened
        : METRIC_NAMES.wordBookOpened

    void progressProvider
      .incrementMetric(profile.id, metric)
      .catch((error: unknown) => {
        console.warn("[words] Could not record the open", error)
      })
  }, [profile.id, tab])

  const meaningFor = (word: CollectedWord["word"], active: Locale) =>
    active === "zh" ? word.meaningZh : word.meaningEn

  let content: ReactNode

  if (progress === null) {
    content = (
      <p role="status" className="words-loading">
        {t("common.loading")}
      </p>
    )
  } else if (failed) {
    content = (
      <p className="form-error" role="alert">
        {t("errors.generic")}
      </p>
    )
  } else if (tab === "collection") {
    const collected = getCollected(progress, WORDS)
    const counts = countByStatus(progress, WORDS)
    const topicCounts = countByTopic(collected)
    const visible = applyFilters(collected, filters, Date.now())

    content =
      counts.total === 0 ? (
        <EmptyState
          message={t("words.emptyCollection")}
          action={t("words.startSession")}
          onAction={() => navigate({ id: "session" })}
        />
      ) : (
        <>
          <header className="words-summary">
            <p className="words-total">
              {t("words.collectedCount", { count: counts.total })}
            </p>
            <ul className="words-counts">
              <li className="words-count words-count-learning">
                <span>{t("words.learning")}</span>
                <strong>{counts.learning}</strong>
              </li>
              <li className="words-count words-count-mastered">
                <span>{t("words.mastered")}</span>
                <strong>{counts.mastered}</strong>
              </li>
            </ul>
          </header>

          {topicCounts.length > 0 ? (
            <section
              className="words-breakdown"
              aria-labelledby="words-breakdown-title"
            >
              <h2 id="words-breakdown-title" className="words-breakdown-title">
                {t("words.byTopic")}
              </h2>
              <ul className="words-topic-counts">
                {topicCounts.map(({ topicId, count }) => {
                  const topic = TOPICS_BY_ID.get(topicId)

                  if (topic === undefined) {
                    return null
                  }

                  return (
                    <li key={topicId} className="words-topic-count">
                      <span aria-hidden="true">{topic.icon}</span>{" "}
                      {locale === "zh" ? topic.titleZh : topic.title}
                      <strong>{count}</strong>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <fieldset className="words-filters">
            <legend className="words-filters-title">
              {t("words.filters")}
            </legend>
            <div className="words-filter-grid">
              <label className="words-filter">
                <span>{t("words.topicFilter")}</span>
                <select
                  value={filters.topicId ?? ""}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      topicId:
                        event.target.value === "" ? null : event.target.value,
                    })
                  }
                >
                  <option value="">{t("words.allTopics")}</option>
                  {TOPICS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {locale === "zh" ? topic.titleZh : topic.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="words-filter">
                <span>{t("words.statusFilter")}</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      status: event.target.value as StatusFilter,
                    })
                  }
                >
                  <option value="all">{t("words.allStatuses")}</option>
                  <option value="learning">{t("words.learning")}</option>
                  <option value="mastered">{t("words.mastered")}</option>
                </select>
              </label>

              <label className="words-filter words-filter-check">
                <input
                  type="checkbox"
                  checked={filters.recentlyLearned}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      recentlyLearned: event.target.checked,
                    })
                  }
                />
                <span>{t("words.recentlyLearned")}</span>
              </label>
            </div>

            {hasActiveFilters(filters) ? (
              <button
                type="button"
                className="words-clear"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS)
                  // The button disappears after this click; put focus back on
                  // the restored list instead of dropping it to the body.
                  requestAnimationFrame(() => listRef.current?.focus())
                }}
              >
                {t("words.clearFilters")}
              </button>
            ) : null}
          </fieldset>

          {visible.length === 0 ? (
            <p className="words-empty-copy" role="status">
              {t("words.noMatches")}
            </p>
          ) : (
            <ul
              ref={listRef}
              tabIndex={-1}
              className="words-list"
              aria-label={t("words.collectionTitle")}
            >
              {visible.map((entry) => {
                const percent = Math.round(entry.progress.strength * 100)

                return (
                  <li key={entry.word.id}>
                    <button
                      type="button"
                      className="words-row"
                      onClick={() =>
                        navigate({
                          id: "word-detail",
                          wordId: entry.word.id,
                          tab: "collection",
                        })
                      }
                    >
                      <WordArtwork
                        word={entry.word}
                        className="words-row-art"
                        alt=""
                      />
                      <span className="words-row-body">
                        <span className="words-row-word">
                          {entry.word.text}
                        </span>
                        <span className="words-row-meaning">
                          {meaningFor(entry.word, locale)}
                        </span>
                        <span
                          className="words-strength"
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
                        </span>
                      </span>
                      <span
                        className={`words-badge words-badge-${entry.progress.status}`}
                      >
                        {t(STATUS_KEYS[entry.progress.status])}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )
  } else {
    const mastered = getMastered(progress, WORDS)

    content =
      mastered.length === 0 ? (
        <EmptyState
          message={t("words.emptyWordBook")}
          action={t("words.startSession")}
          onAction={() => navigate({ id: "session" })}
        />
      ) : (
        <ul className="wordbook-grid">
          {mastered.map((entry) => (
            <li key={entry.word.id}>
              <button
                type="button"
                className="wordbook-card"
                onClick={() =>
                  navigate({
                    id: "word-detail",
                    wordId: entry.word.id,
                    tab: "wordbook",
                  })
                }
              >
                <WordArtwork
                  word={entry.word}
                  className="wordbook-art"
                  alt=""
                />
                <span className="wordbook-word">{entry.word.text}</span>
                <span className="wordbook-meaning">
                  {meaningFor(entry.word, locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )
  }

  return (
    <section className="words-screen">
      <nav className="words-tabs" aria-label={t("words.tabsLabel")}>
        <button
          type="button"
          className="words-tab"
          aria-current={tab === "collection" ? "page" : undefined}
          onClick={() => navigate({ id: "words", tab: "collection" })}
        >
          {t("words.collectionTitle")}
        </button>
        <button
          type="button"
          className="words-tab"
          aria-current={tab === "wordbook" ? "page" : undefined}
          onClick={() => navigate({ id: "words", tab: "wordbook" })}
        >
          {t("words.wordBookTitle")}
        </button>
      </nav>

      <div
        role="region"
        className="words-panel"
        aria-label={t(
          tab === "collection"
            ? "words.collectionTitle"
            : "words.wordBookTitle",
        )}
      >
        {content}
      </div>
    </section>
  )
}

function EmptyState({
  message,
  action,
  onAction,
}: {
  message: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="words-empty">
      <p className="words-empty-copy">{message}</p>
      <button type="button" className="primary-button" onClick={onAction}>
        {action}
      </button>
    </div>
  )
}
