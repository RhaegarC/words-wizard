import type { Word } from "../types"

import type { ArtworkEntry } from "./types"

export type ResolvedArtwork =
  | { kind: "image"; src: string }
  | { kind: "placeholder"; emoji: string; label: string }

/**
 * Approved art wins; anything else gets a tile built from the word itself, so
 * an unauthored illustration never leaves a blank hole in a screen.
 */
export function resolveArtwork(
  word: Word,
  entry: ArtworkEntry | undefined,
): ResolvedArtwork {
  if (entry?.status === "approved") {
    return { kind: "image", src: assetSrc(entry.file) }
  }

  return {
    kind: "placeholder",
    emoji: word.emoji ?? word.text.charAt(0).toUpperCase(),
    label: word.text,
  }
}

/** Public assets stay relative so the build also works from a sub-path. */
export function assetSrc(file: string): string {
  return file.startsWith("./") || file.startsWith("/") ? file : `./${file}`
}
