import { getArtwork } from "../content"
import { resolveArtwork } from "../domain/content/artwork"
import type { Word } from "../domain/types"

export type WordArtworkProps = {
  word: Word
  className?: string
}

/**
 * Approved art renders as an image; everything else gets a readable tile, so
 * the 300 words can be played before feature 17 draws them.
 */
export function WordArtwork({ word, className }: WordArtworkProps) {
  const artwork = resolveArtwork(word, getArtwork(word.id))
  const classes = ["word-artwork", className].filter(Boolean).join(" ")

  if (artwork.kind === "image") {
    return (
      <img
        className={classes}
        src={artwork.src}
        alt={word.text}
        loading="lazy"
      />
    )
  }

  return (
    <span
      className={`${classes} word-artwork-placeholder`}
      role="img"
      aria-label={word.text}
    >
      <span aria-hidden="true">{artwork.emoji}</span>
    </span>
  )
}
