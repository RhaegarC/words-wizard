import { useState } from "react"

import { assetSrc } from "../domain/content/artwork"
import type { Avatar } from "../domain/content/types"
import type { StageId } from "../domain/types"

export type AvatarStageProps = {
  avatar: Avatar | undefined
  stage: StageId
  /** The accessible name, e.g. "Luma — Hatchling". */
  alt: string
  /** Localized stage name for the placeholder tile. */
  stageLabel: string
  className?: string
}

/**
 * Avatar art resolves as `avatar × stage`. Feature 17 has not drawn the 15
 * images yet, so a missing file falls back to a styled tile with the avatar's
 * own colour: never a broken-image icon and never a layout shift.
 */
export function AvatarStage({
  avatar,
  stage,
  alt,
  stageLabel,
  className,
}: AvatarStageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = avatar ? assetSrc(avatar.stages[stage]) : null
  const classes = ["avatar-stage", className].filter(Boolean).join(" ")

  if (src !== null && failedSrc !== src) {
    return (
      <img
        className={classes}
        src={src}
        alt={alt}
        onError={() => setFailedSrc(src)}
      />
    )
  }

  return (
    <span
      className={`${classes} avatar-stage-placeholder`}
      role="img"
      aria-label={alt}
      style={{
        // The pale avatar colour is the identity cue; the text stays ink so
        // the placeholder is readable, not just decorative.
        background: avatar?.pale ?? "var(--pale-purple)",
        color: "var(--ink)",
      }}
    >
      <span className="avatar-stage-mark" aria-hidden="true">
        {avatar ? avatar.name.charAt(0) : "?"}
      </span>
      <span className="avatar-stage-label" aria-hidden="true">
        {stageLabel}
      </span>
    </span>
  )
}
