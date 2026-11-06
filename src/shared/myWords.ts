import { config } from "./config"
import { daysSinceLocal } from "./time"
import type { Progress, ProgressStatus, Word, WordExample } from "./types"

/** A word the child has met, joined to the progress row that proves it. */
export interface CollectedWord {
  word: Word
  progress: Progress
}

export interface StatusCounts {
  total: number
  learning: number
  mastered: number
}

/** The statuses a child can filter by; `new` never enters the collection. */
export type StatusFilter = "all" | Exclude<ProgressStatus, "new">

export interface WordFilters {
  topicId: string | null
  status: StatusFilter
  recentlyLearned: boolean
}

export const DEFAULT_FILTERS: WordFilters = {
  topicId: null,
  status: "all",
  recentlyLearned: false,
}

/**
 * PRD §7.3. The collection is every learned word, keyed by `wordId`, newest
 * first. A demoted word stays here — the total never shrinks — and a word
 * shared by two packs is still one entry.
 */
export function getCollected(
  progress: readonly Progress[],
  words: readonly Word[],
): CollectedWord[] {
  const wordsById = new Map(words.map((word) => [word.id, word]))
  const latest = new Map<string, Progress>()

  for (const row of progress) {
    if (row.status === "new" || !wordsById.has(row.wordId)) {
      continue
    }

    const current = latest.get(row.wordId)

    if (current === undefined || row.lastSeenAt > current.lastSeenAt) {
      latest.set(row.wordId, row)
    }
  }

  return [...latest.values()]
    .map((row) => ({ word: wordsById.get(row.wordId)!, progress: row }))
    .sort(
      (left, right) =>
        right.progress.lastSeenAt - left.progress.lastSeenAt ||
        left.word.id.localeCompare(right.word.id),
    )
}

/** PRD §7.3. The Word Book holds mastered words only. */
export function getMastered(
  progress: readonly Progress[],
  words: readonly Word[],
): CollectedWord[] {
  return getCollected(progress, words).filter(
    (entry) => entry.progress.status === "mastered",
  )
}

export function countByStatus(
  progress: readonly Progress[],
  words: readonly Word[],
): StatusCounts {
  const collected = getCollected(progress, words)
  const mastered = collected.filter(
    (entry) => entry.progress.status === "mastered",
  ).length

  return {
    total: collected.length,
    learning: collected.length - mastered,
    mastered,
  }
}

export interface TopicCount {
  topicId: string
  count: number
}

/**
 * PRD §7.3 "breakdown by topic". A word shared by two topics counts in both,
 * because the filter treats it the same way.
 */
export function countByTopic(entries: readonly CollectedWord[]): TopicCount[] {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    for (const topicId of entry.word.topicIds) {
      counts.set(topicId, (counts.get(topicId) ?? 0) + 1)
    }
  }

  return [...counts]
    .map(([topicId, count]) => ({ topicId, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.topicId.localeCompare(right.topicId),
    )
}

export function filterByTopic(
  entries: readonly CollectedWord[],
  topicId: string,
): CollectedWord[] {
  return entries.filter((entry) => entry.word.topicIds.includes(topicId))
}

export function filterByStatus(
  entries: readonly CollectedWord[],
  status: StatusFilter,
): CollectedWord[] {
  return status === "all"
    ? [...entries]
    : entries.filter((entry) => entry.progress.status === status)
}

/**
 * PRD §7.3. "Recently learned" is when the word entered the collection, not
 * when it was last practised: reviewing an old word must not make it new.
 */
export function filterRecentlyLearned(
  entries: readonly CollectedWord[],
  now: number,
): CollectedWord[] {
  const windowDays = config.myWords.recentlyLearnedDays

  return entries.filter(
    (entry) => daysSinceLocal(entry.progress.firstSeenAt, now) <= windowDays,
  )
}

export function applyFilters(
  entries: readonly CollectedWord[],
  filters: WordFilters,
  now: number,
): CollectedWord[] {
  let result: CollectedWord[] = [...entries]

  if (filters.topicId !== null) {
    result = filterByTopic(result, filters.topicId)
  }

  result = filterByStatus(result, filters.status)

  if (filters.recentlyLearned) {
    result = filterRecentlyLearned(result, now)
  }

  return result
}

export function hasActiveFilters(filters: WordFilters): boolean {
  return (
    filters.topicId !== null ||
    filters.status !== "all" ||
    filters.recentlyLearned
  )
}

export interface WordDetailView {
  text: string
  phonetic: string
  meaningEn: string
  meaningZh: string
  definitionEn: string
  definitionZh: string
  example: WordExample
  /** R2 URL, or null while the word has only a placeholder tile. */
  image: string | null
  topicIds: readonly string[]
  status: ProgressStatus
  strength: number
}

/**
 * Everything the detail screen shows, independent of storage. Both language
 * versions of the meaning and definition travel together so the detail view is
 * readable whichever UI language is active; only the labels are localized.
 */
export function buildWordDetail(
  word: Word,
  progress: Progress | undefined,
): WordDetailView {
  return {
    text: word.text,
    phonetic: word.phonetic,
    meaningEn: word.meaningEn,
    meaningZh: word.meaningZh,
    definitionEn: word.definitionEn,
    definitionZh: word.definitionZh,
    example: word.examples[0],
    image: word.image,
    topicIds: word.topicIds,
    status: progress?.status ?? "new",
    strength: progress?.strength ?? 0,
  }
}
