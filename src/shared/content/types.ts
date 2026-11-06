import type { Pack, StageId, Topic, Word } from "../types"

export type DatasetKind = "dev" | "final"

/** The single `content_meta` row. */
export interface ContentMeta {
  schemaVersion: number
  dataset: DatasetKind
  contentVersion: string
}

/** `avatars` + `avatar_stages`: one identity per buddy, five stages mapped to its portrait. */
export interface Avatar {
  id: string
  name: string
  nameZh: string
  color: string
  pale: string
  stages: Record<StageId, string>
}

/** Everything `GET /v1/content` serves, in the shape the validator checks. */
export interface ContentBundle {
  meta: ContentMeta
  topics: Topic[]
  packs: Pack[]
  words: Word[]
  avatars: Avatar[]
}

export type ContentIssueCode =
  | "duplicate-id"
  | "pack-topic-ref"
  | "pack-word-ref"
  | "word-topic-ref"
  | "topic-no-packs"
  | "pack-no-words"
  | "pack-duplicate-word"
  | "word-no-topic"
  | "word-text-duplicate"
  | "bad-level"
  | "word-empty-field"
  | "word-no-examples"
  | "example-unpaired"
  | "image-url"
  | "avatar-count"
  | "avatar-stage-missing"
  | "example-missing-word"
  | "forbidden-term"
  | "abstract-word-missing"
  | "word-not-in-allowlist"

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
