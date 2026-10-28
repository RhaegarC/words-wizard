import { useEffect, useRef, useState, type ReactNode } from "react"

import { Icon } from "../components/Icon"
import { topicTone } from "../components/tone"
import { WordArtwork } from "../components/WordArtwork"
import { useProfileProgress } from "../components/useProfileProgress"
import { getAllWords, getTopics } from "../content"
import { progressProvider } from "../db"
import { METRIC_NAMES } from "@shared/metrics"
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
} from "@shared/myWords"
import type { Locale, Profile } from "@shared/types"
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
  const definitionFor = (word: CollectedWord["word"], active: Locale) =>
    active === "zh" ? word.definitionZh : word.definitionEn

  const collected = progress === null ? null : getCollected(progress, WORDS)
  const mastered = progress === null ? null : getMastered(progress, WORDS)
  const heading = t(
    tab === "collection" ? "words.collectionTitle" : "words.wordBookTitle",
  )
  const tabCount =
    tab === "collection" ? (collected?.length ?? 0) : (mastered?.length ?? 0)

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
    const entries = collected ?? []
    const counts = countByStatus(progress, WORDS)
    const topicCounts = countByTopic(entries)
    const visible = applyFilters(entries, filters, Date.now())

    content =
      counts.total === 0 ? (
        <EmptyState
          message={t("words.emptyCollection")}
          action={t("words.startSession")}
          onAction={() => navigate({ id: "session" })}
        />
      ) : (
        <>
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
                    <li
                      key={topicId}
                      className={`words-topic-count ${topicTone(topicId)}`}
                    >
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
              className="word-grid"
              aria-label={t("words.collectionTitle")}
            >
              {visible.map((entry) => {
                const percent = Math.round(entry.progress.strength * 100)

                return (
                  <li key={entry.word.id}>
                  <button
                    type="button"
                    className={`word-tile ${topicTone(entry.word.topicIds[0])}`}
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
                      className="tile-art"
                      alt=""
                    />
                    <small>{t(STATUS_KEYS[entry.progress.status])}</small>
                    <h3>{entry.word.text}</h3>
                    <strong>{meaningFor(entry.word, locale)}</strong>
                    <p>{definitionFor(entry.word, locale)}</p>
                    <footer>
                      <span
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                        aria-label={t("words.strength")}
                      >
                        <i style={{ width: `${percent}%` }} />
                      </span>
                      <em>{t("words.strength")}</em>
                    </footer>
                  </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )
  } else {
    const entries = mastered ?? []

    content =
      entries.length === 0 ? (
        <EmptyState
          message={t("words.emptyWordBook")}
          action={t("words.startSession")}
          onAction={() => navigate({ id: "session" })}
        />
      ) : (
        <ul className="word-grid book-grid">
          {entries.map((entry) => {
            const percent = Math.round(entry.progress.strength * 100)

            return (
              <li key={entry.word.id}>
              <button
                type="button"
                className={`word-tile ${topicTone(entry.word.topicIds[0])}`}
                onClick={() =>
                  navigate({
                    id: "word-detail",
                    wordId: entry.word.id,
                    tab: "wordbook",
                  })
                }
              >
                <WordArtwork word={entry.word} className="tile-art" alt="" />
                <small>{t("words.mastered")}</small>
                <h3>{entry.word.text}</h3>
                <strong>{meaningFor(entry.word, locale)}</strong>
                <p>{definitionFor(entry.word, locale)}</p>
                <footer>
                  <span
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-label={t("words.strength")}
                  >
                    <i style={{ width: `${percent}%` }} />
                  </span>
                  <em>{t("words.strength")}</em>
                </footer>
              </button>
              </li>
            )
          })}
        </ul>
      )
  }

  return (
    <section className="word-page">
      <header>
        <div>
          <span className="eyebrow">{t("words.pageEyebrow")}</span>
          <h2>{heading}</h2>
          <p>
            {tab === "collection"
              ? t("words.collectedCount", { count: tabCount })
              : t("words.bookBannerBody")}
          </p>
        </div>
        <aside>
          <Icon name="book" size={22} />
          <b>{tabCount}</b>
          <span>{t("words.allWords")}</span>
        </aside>
      </header>

      <nav className="word-tabs" aria-label={t("words.tabsLabel")}>
        <button
          type="button"
          className={tab === "collection" ? "active" : undefined}
          aria-current={tab === "collection" ? "page" : undefined}
          onClick={() => navigate({ id: "words", tab: "collection" })}
        >
          {t("words.collectionTitle")}
          <small>{collected?.length ?? 0}</small>
        </button>
        <button
          type="button"
          className={tab === "wordbook" ? "active" : undefined}
          aria-current={tab === "wordbook" ? "page" : undefined}
          onClick={() => navigate({ id: "words", tab: "wordbook" })}
        >
          {t("words.wordBookTitle")}
          <small>{mastered?.length ?? 0}</small>
        </button>
      </nav>

      {tab === "wordbook" ? (
        <div className="book-banner">
          <Icon name="sparkle" />
          <span>
            <b>{t("words.bookBannerTitle")}</b>
            <small>{t("words.bookBannerBody")}</small>
          </span>
        </div>
      ) : null}

      <div className="words-panel">{content}</div>
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
      <button type="button" className="button primary" onClick={onAction}>
        {action}
      </button>
    </div>
  )
}
