import type { Avatar, ContentBundle } from "@shared/content/types"
import type { HomeContent } from "@shared/home"
import type { Pack, Topic, Word } from "@shared/types"

/**
 * The one module that knows how content is stored.
 *
 * Mission 2 serves content from `GET /v1/content`; feature 22 loads that
 * bundle once at boot and feature 24 wires the fetch. Until then the bundle is
 * absent, so every accessor answers emptily rather than throwing: the app can
 * boot to a loading state.
 */
interface LoadedContent {
  readonly meta: ContentBundle["meta"]
  readonly topics: readonly Topic[]
  readonly packs: readonly Pack[]
  readonly words: readonly Word[]
  readonly avatars: readonly Avatar[]
  readonly topicsById: ReadonlyMap<string, Topic>
  readonly packsById: ReadonlyMap<string, Pack>
  readonly wordsById: ReadonlyMap<string, Word>
  readonly packsByTopic: ReadonlyMap<string, readonly Pack[]>
  readonly wordsByTopic: ReadonlyMap<string, readonly Word[]>
}

const EMPTY: readonly never[] = Object.freeze([])

let loaded: LoadedContent | undefined

/**
 * Replace the active bundle. Called once per boot by the content fetch; the
 * data is frozen so a screen cannot mutate it.
 */
export function loadContent(bundle: ContentBundle): void {
  const meta = deepFreeze(bundle.meta)
  const topics = deepFreeze([...bundle.topics])
  const packs = deepFreeze([...bundle.packs])
  const words = deepFreeze([...bundle.words])
  const avatars = deepFreeze([...bundle.avatars])

  const packsByTopic = new Map<string, readonly Pack[]>(
    topics.map((topic) => [
      topic.id,
      Object.freeze(
        packs
          .filter((pack) => pack.topicId === topic.id)
          .sort((a, b) => a.order - b.order),
      ),
    ]),
  )

  loaded = {
    meta,
    topics,
    packs,
    words,
    avatars,
    topicsById: new Map(topics.map((topic) => [topic.id, topic])),
    packsById: new Map(packs.map((pack) => [pack.id, pack])),
    wordsById: new Map(words.map((word) => [word.id, word])),
    packsByTopic,
    wordsByTopic: new Map(
      topics.map((topic) => [
        topic.id,
        Object.freeze(words.filter((word) => word.topicIds.includes(topic.id))),
      ]),
    ),
  }
}

/** Drop the bundle; used by tests and by sign-out in feature 24. */
export function clearContent(): void {
  loaded = undefined
}

export function getTopics(): readonly Topic[] {
  return loaded?.topics ?? EMPTY
}

export function getTopic(id: string): Topic | undefined {
  return loaded?.topicsById.get(id)
}

/** A topic's packs, ascending by `order`. */
export function getPacksByTopic(topicId: string): readonly Pack[] {
  return loaded?.packsByTopic.get(topicId) ?? EMPTY
}

export function getPack(id: string): Pack | undefined {
  return loaded?.packsById.get(id)
}

export function getWord(id: string): Word | undefined {
  return loaded?.wordsById.get(id)
}

/** Resolved words in the requested order; unknown ids are skipped. */
export function getWordsByIds(ids: readonly string[]): readonly Word[] {
  if (loaded === undefined) return EMPTY

  const words = loaded.wordsById

  return Object.freeze(
    ids
      .map((id) => words.get(id))
      .filter((word): word is Word => word !== undefined),
  )
}

export function getWordsByTopic(topicId: string): readonly Word[] {
  return loaded?.wordsByTopic.get(topicId) ?? EMPTY
}

/** Every word, for the session builder and the monthly review. */
export function getAllWords(): readonly Word[] {
  return loaded?.words ?? EMPTY
}

/** Every pack, for the session builder's unlock rules. */
export function getAllPacks(): readonly Pack[] {
  return loaded?.packs ?? EMPTY
}

export function getAvatarSet(): readonly Avatar[] {
  return loaded?.avatars ?? EMPTY
}

export function getContentMeta(): ContentBundle["meta"] {
  return loaded?.meta ?? { schemaVersion: 1, dataset: "dev", contentVersion: "" }
}

/**
 * Everything Home's builder needs in one bundle. Home never searches the
 * content itself; the builder receives all words because due reviews are
 * global across topics.
 */
export function getHomeContent(): HomeContent {
  return {
    packs: getAllPacks(),
    words: getAllWords(),
    avatars: getAvatarSet(),
    contentVersion: getContentMeta().contentVersion,
  }
}

/** Content is read-only; freeze it so a screen cannot mutate it. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)

    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }

  return value
}
