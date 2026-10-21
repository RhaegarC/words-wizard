import avatarsJson from "./avatars.json"
import artworkJson from "./art/manifest.json"
import contentMetaJson from "./content-meta.json"
import packsJson from "./packs.json"
import topicsJson from "./topics.json"
import wordsJson from "./words.json"

import type {
  ArtworkEntry,
  ArtworkManifest,
  Avatar,
  ContentMeta,
} from "../domain/content/types"
import type { Pack, Topic, Word } from "../domain/types"

/**
 * The one module that knows how content is stored. Screens ask these
 * functions; nothing else imports a JSON file.
 *
 * `prebuild` runs `pnpm validate:content`, so the JSON is checked against the
 * contract (types in `domain/content/types.ts`) before these casts are used.
 */
const contentMeta = deepFreeze(contentMetaJson) as ContentMeta
const topics = deepFreeze(topicsJson) as unknown as readonly Topic[]
const packs = deepFreeze(packsJson) as unknown as readonly Pack[]
const words = deepFreeze(wordsJson) as unknown as readonly Word[]
const avatars = deepFreeze(avatarsJson) as unknown as readonly Avatar[]
const artwork = deepFreeze(artworkJson) as unknown as ArtworkManifest

const EMPTY: readonly never[] = Object.freeze([])

const topicsById = new Map(topics.map((topic) => [topic.id, topic]))
const packsById = new Map(packs.map((pack) => [pack.id, pack]))
const wordsById = new Map(words.map((word) => [word.id, word]))

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

const wordsByTopic = new Map<string, readonly Word[]>(
  topics.map((topic) => [
    topic.id,
    Object.freeze(words.filter((word) => word.topicIds.includes(topic.id))),
  ]),
)

export function getTopics(): readonly Topic[] {
  return topics
}

export function getTopic(id: string): Topic | undefined {
  return topicsById.get(id)
}

/** A topic's packs, ascending by `order`. */
export function getPacksByTopic(topicId: string): readonly Pack[] {
  return packsByTopic.get(topicId) ?? EMPTY
}

export function getPack(id: string): Pack | undefined {
  return packsById.get(id)
}

export function getWord(id: string): Word | undefined {
  return wordsById.get(id)
}

/** Resolved words in the requested order; unknown ids are skipped. */
export function getWordsByIds(ids: readonly string[]): readonly Word[] {
  return Object.freeze(
    ids
      .map((id) => wordsById.get(id))
      .filter((word): word is Word => word !== undefined),
  )
}

export function getWordsByTopic(topicId: string): readonly Word[] {
  return wordsByTopic.get(topicId) ?? EMPTY
}

/** Every word, for the session builder (reviews may come from any topic). */
export function getAllWords(): readonly Word[] {
  return words
}

/** Every pack, for the session builder's unlock rules. */
export function getAllPacks(): readonly Pack[] {
  return packs
}

export function getAvatarSet(): readonly Avatar[] {
  return avatars
}

export function getArtwork(wordId: string): ArtworkEntry | undefined {
  return artwork[wordId]
}

export function getContentMeta(): ContentMeta {
  return contentMeta
}

/** Content is bundled read-only; freeze it so a screen cannot mutate it. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)

    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }

  return value
}
