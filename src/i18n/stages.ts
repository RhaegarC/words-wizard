import type { StageId } from "../domain/types"

import type { MessageKey } from "./messages"

const STAGE_KEYS: Record<StageId, MessageKey> = {
  egg: "character.stage.egg",
  hatchling: "character.stage.hatchling",
  juvenile: "character.stage.juvenile",
  adult: "character.stage.adult",
  legendary: "character.stage.legendary",
}

export function stageMessageKey(stage: StageId): MessageKey {
  return STAGE_KEYS[stage]
}
