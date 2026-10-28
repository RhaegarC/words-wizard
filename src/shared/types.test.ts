import { describe, expect, expectTypeOf, it } from "vitest"

import { config } from "./config"
import {
  PRACTICE_MODES,
  STAGE_IDS,
  type CharacterState,
  type Device,
  type Metric,
  type Pack,
  type PracticeMode,
  type Profile,
  type Progress,
  type SessionResult,
  type StageId,
  type Topic,
  type Word,
} from "./types"

describe("shared vocabulary", () => {
  it("exports stage ids exactly as configured, in order", () => {
    expect(STAGE_IDS).toEqual(config.stages.map((stage) => stage.id))
    expect(STAGE_IDS).toEqual([
      "egg",
      "hatchling",
      "juvenile",
      "adult",
      "legendary",
    ])
  })

  it("has five unique practice modes", () => {
    expect(PRACTICE_MODES).toHaveLength(5)
    expect(new Set(PRACTICE_MODES).size).toBe(5)
    expect(PRACTICE_MODES).toEqual([
      "pictureMatch",
      "wordToMeaning",
      "spellingBuilder",
      "fillBlank",
      "listenChoose",
    ])
  })

  it("exports every canonical record type used by later features", () => {
    expectTypeOf<Word>().not.toBeAny()
    expectTypeOf<Topic>().not.toBeAny()
    expectTypeOf<Pack>().not.toBeAny()
    expectTypeOf<Profile>().not.toBeAny()
    expectTypeOf<Progress>().not.toBeAny()
    expectTypeOf<Metric>().not.toBeAny()
    expectTypeOf<Device>().not.toBeAny()
    expectTypeOf<CharacterState>().not.toBeAny()
    expectTypeOf<StageId>().not.toBeAny()
    expectTypeOf<PracticeMode>().not.toBeAny()
    expectTypeOf<SessionResult>().not.toBeAny()
  })
})
