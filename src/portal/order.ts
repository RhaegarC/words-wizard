/**
 * Move one id up or down in a curated list. The list is returned as a new
 * array; an edge move or an unknown id leaves the order alone.
 */
export function moveId(
  ids: readonly string[],
  id: string,
  offset: -1 | 1,
): string[] {
  const from = ids.indexOf(id)
  const to = from + offset

  if (from === -1 || to < 0 || to >= ids.length) return [...ids]

  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}
