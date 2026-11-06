import type { DatasetKind } from "./content/types"
import type { Role, Word } from "./types"

/**
 * The admin read model (feature 28).
 *
 * It is the same content data the public bundle serves, minus the filtering:
 * archived rows stay, a word in no pack stays, and every pack has a membership
 * entry so the portal does not special-case an empty pack. Writes arrive in
 * features 29–31; this shape is what they refresh after each mutation.
 */

export interface AdminTopic {
  id: string
  title: string
  titleZh: string
  icon: string
  description: string
  descriptionZh: string
  sortOrder: number
  /** Server milliseconds, or null while the topic is live. */
  archivedAt: number | null
}

export interface AdminPack {
  id: string
  topicId: string
  title: string
  titleZh: string
  sortOrder: number
  archivedAt: number | null
}

/**
 * A word as the portal edits it. Every word is present, including one in no
 * pack and one archived by a historical import. `topicIds` is derived from
 * every membership, archived ancestry included.
 */
export interface AdminWord extends Word {
  archivedAt: number | null
}

/** One pack's ordered word ids, `1..N`. An empty pack is an empty array. */
export interface AdminMembership {
  packId: string
  wordIds: string[]
}

export interface AdminSnapshot {
  contentVersion: string
  dataset: DatasetKind
  topics: AdminTopic[]
  packs: AdminPack[]
  words: AdminWord[]
  memberships: AdminMembership[]
}

/** `GET /v1/admin/access`: the caller's verified token role. */
export interface AdminAccess {
  role: Role
}
