import type { Pack, StageId, Topic, Word } from "../types"

export type DatasetKind = "dev" | "final"

/** `content-meta.json`. */
export interface ContentMeta {
  schemaVersion: number
  dataset: DatasetKind
  contentVersion: string
}

export type ArtworkStatus = "approved" | "placeholder"

/** One `art/manifest.json` entry. */
export interface ArtworkEntry {
  file: string
  status: ArtworkStatus
}

export type ArtworkManifest = Record<string, ArtworkEntry>

/** `avatars.json`: three identities, five stages each. */
export interface Avatar {
  id: string
  name: string
  nameZh: string
  color: string
  pale: string
  stages: Record<StageId, string>
}

/** Everything the loader bundles, in the shape the validator checks. */
export interface ContentBundle {
  meta: ContentMeta
  topics: Topic[]
  packs: Pack[]
  words: Word[]
  avatars: Avatar[]
  artwork: ArtworkManifest
}

export type ContentIssueCode =
  | "topic-count"
  | "pack-count"
  | "pack-slots"
  | "duplicate-id"
  | "pack-topic-ref"
  | "topic-pack-ref"
  | "word-topic-ref"
  | "pack-word-ref"
  | "bad-level"
  | "word-empty-field"
  | "word-no-examples"
  | "example-unpaired"
  | "example-missing-word"
  | "art-manifest-missing"
  | "art-missing"
  | "art-placeholder"
  | "forbidden-term"
  | "bad-unlock"
  | "pack-order"
  | "final-distinct-words"
  | "abstract-word-missing"
  | "avatar-count"
  | "avatar-stage-missing"

export type IssueSeverity = "error" | "warning"

/** A validator finding. `id` names the offending record, or is empty for a
 * bundle-level rule. */
export interface ContentIssue {
  code: ContentIssueCode
  severity: IssueSeverity
  file: string
  id: string
  message: string
}
