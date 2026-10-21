import { getArtwork } from "../content"
import { resolveArtwork } from "../domain/content/artwork"
import type { Word } from "../domain/types"

export type WordArtworkProps = {
  word: Word
  className?: string
  /**
   * Accessible name. Pass `""` when naming the picture would give an answer
   * away (the picture-match prompt, listening options); the art is then
   * decorative and the surrounding control carries the label.
   */
  alt?: string
}

/**
 * Approved art renders as an image; everything else gets a readable tile, so
 * the 300 words can be played before feature 17 draws them.
 */
export function WordArtwork({ word, className, alt }: WordArtworkProps) {
  const artwork = resolveArtwork(word, getArtwork(word.id))
  const classes = ["word-artwork", className].filter(Boolean).join(" ")
  const label = alt ?? word.text
  const decorative = label === ""

  if (artwork.kind === "image") {
    return (
      <img className={classes} src={artwork.src} alt={label} loading="lazy" />
    )
  }

  return (
    <span
      className={`${classes} word-artwork-placeholder`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
    >
      <span aria-hidden="true">{artwork.emoji}</span>
    </span>
  )
}
