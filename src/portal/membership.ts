/**
 * The pack-contents screen edits a working draft of the ordered word list and
 * commits the whole list on Save. These helpers are pure so the draft's rules
 * are decidable without a DOM: appends keep the chosen order, removal keeps the
 * rest in place, and dirtiness is order-sensitive — a reorder is a change.
 */

export function addMembers(
  ids: readonly string[],
  additions: readonly string[],
): string[] {
  const next = [...ids]

  for (const id of additions) {
    if (!next.includes(id)) next.push(id)
  }

  return next
}

export function removeMember(ids: readonly string[], id: string): string[] {
  return ids.filter((member) => member !== id)
}

export function isDirty(
  draft: readonly string[],
  saved: readonly string[],
): boolean {
  if (draft.length !== saved.length) return true

  return draft.some((id, index) => id !== saved[index])
}
