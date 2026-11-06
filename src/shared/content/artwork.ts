import type { Word } from "../types"

export type ResolvedArtwork =
  | { kind: "image"; src: string }
  | { kind: "placeholder"; emoji: string; label: string }

/**
 * A word's image is a URL (R2 in a later sprint) or absent. An authored image
 * wins; otherwise a tile is built from the word itself, so an unauthored word
 * never leaves a blank hole in a screen.
 */
export function resolveArtwork(word: Word): ResolvedArtwork {
  if (word.image !== null && word.image.trim() !== "") {
    return { kind: "image", src: word.image }
  }

  return {
    kind: "placeholder",
    emoji: word.emoji ?? word.text.charAt(0).toUpperCase(),
    label: word.text,
  }
}

/** Bundled avatar art stays relative so the build also works from a sub-path. */
export function assetSrc(file: string): string {
  return file.startsWith("./") || file.startsWith("/") ? file : `./${file}`
}
