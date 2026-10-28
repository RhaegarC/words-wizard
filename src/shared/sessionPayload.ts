import type { SessionCommitPayload } from "./provider"

/**
 * Why a session payload was refused. Validation runs before the transaction
 * opens, so a malformed payload cannot leave a partial commit behind.
 */
export type SessionPayloadIssue =
  | "profile-id-missing"
  | "word-id-missing"
  | "duplicate-word-id"
  | "review-in-past"
  | "strength-out-of-range"
  | "negative-xp"

/**
 * A payload is a session that has already ended, so every `nextReviewAt` it
 * carries must land at or after `now`. Returning all issues (rather than
 * throwing on the first) keeps a broken builder debuggable.
 */
export function validateSessionPayload(
  payload: SessionCommitPayload,
): SessionPayloadIssue[] {
  const issues: SessionPayloadIssue[] = []
  const add = (issue: SessionPayloadIssue) => {
    if (!issues.includes(issue)) {
      issues.push(issue)
    }
  }

  if (!Number.isInteger(payload.profileId) || payload.profileId <= 0) {
    add("profile-id-missing")
  }

  if (!isNonNegative(payload.xpEarned)) {
    add("negative-xp")
  }

  if (payload.profile.xp !== undefined && !isNonNegative(payload.profile.xp)) {
    add("negative-xp")
  }

  const seen = new Set<string>()

  for (const row of payload.progress) {
    const wordId = row.wordId.trim()

    if (wordId === "") {
      add("word-id-missing")
    } else if (seen.has(wordId)) {
      add("duplicate-word-id")
    } else {
      seen.add(wordId)
    }

    if (
      !Number.isFinite(row.strength) ||
      row.strength < 0 ||
      row.strength > 1
    ) {
      add("strength-out-of-range")
    }

    if (!Number.isFinite(row.nextReviewAt) || row.nextReviewAt < payload.now) {
      add("review-in-past")
    }
  }

  return issues
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}
