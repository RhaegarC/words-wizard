import { useState } from "react"

import { assetSrc } from "../domain/content/artwork"
import type { Avatar } from "../domain/content/types"

/**
 * The single portrait a buddy is identified by. The bundled set has one image
 * per character rather than separate stage art, so every stage resolves to the
 * same file. A missing file falls back to the initial on the avatar's pale
 * colour, matching `AvatarStage`.
 */
export function AvatarPortrait({ avatar }: { avatar: Avatar }) {
  const [failed, setFailed] = useState(false)
  const src = assetSrc(avatar.stages.adult)

  if (failed) {
    return (
      <span
        className="avatar-tile"
        style={{ background: avatar.pale, color: avatar.color }}
        aria-hidden="true"
      >
        {avatar.name.charAt(0)}
      </span>
    )
  }

  return (
    <img
      className="avatar-tile avatar-portrait"
      src={src}
      alt=""
      aria-hidden="true"
      style={{ background: avatar.pale }}
      onError={() => setFailed(true)}
    />
  )
}
