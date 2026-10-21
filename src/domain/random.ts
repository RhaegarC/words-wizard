/**
 * Seeded randomness for the session builder.
 *
 * A session must reproduce the same mode order for the same profile, local
 * day, kind, and content version, so nothing here reads `Math.random()`.
 */

/** FNV-1a over UTF-16 code units; stable across runs and platforms. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

/** mulberry32: small, fast, and good enough for shuffling a handful of modes. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Fisher–Yates over a copy; the caller's array is never mutated. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    const current = result[index]

    result[index] = result[swap]
    result[swap] = current
  }

  return result
}
