import {
  validateAvatarId,
  validateCharacterName,
  type NameRejection,
} from "./firstRun"
import type { Profile } from "./types"

/**
 * Feature 14 reuses feature 06's rules exactly. The patch carries only the
 * three editable fields, so saving a buddy can never touch `createdAt`, the
 * practice clock, progress, streak, or tokens.
 */
export type RecustomizeError = NameRejection | "avatar"

export type RecustomizePatch = Pick<
  Profile,
  "name" | "characterName" | "avatar"
>

export type RecustomizeResult =
  | { ok: true; patch: RecustomizePatch }
  | { ok: false; reason: RecustomizeError }

export function buildRecustomizePatch(input: {
  characterName: string
  avatar: string
}): RecustomizeResult {
  const name = validateCharacterName(input.characterName)

  if (!name.ok) {
    return { ok: false, reason: name.reason }
  }

  const avatar = validateAvatarId(input.avatar)

  if (!avatar.ok) {
    return { ok: false, reason: "avatar" }
  }

  return {
    ok: true,
    patch: {
      name: name.value,
      characterName: name.value,
      avatar: avatar.avatar.id,
    },
  }
}
