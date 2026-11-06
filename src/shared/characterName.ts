/**
 * The character-name rule shared by the page's first-run form and the Worker's
 * profile routes (PRD §7.0, feature 06). Pure domain: no storage, no UI.
 */

/** The name bound is 16 Unicode code points. */
export const MAX_CHARACTER_NAME_CODE_POINTS = 16

export type NameRejection = "empty" | "too-long" | "invalid-character"

export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: NameRejection }

// C0/C1 controls cover newlines, tabs, and the other characters a name field
// should never accept. Unicode line/paragraph separators are not controls but
// read as line breaks, so they are rejected with them.
const CONTROL_OR_LINE_BREAK =
  /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u

/**
 * Trim, then count code points rather than UTF-16 units: a Chinese character
 * and an emoji each count once, so the bound matches what a child sees.
 */
export function validateCharacterName(raw: string): NameValidation {
  const value = raw.trim()

  if (value === "") {
    return { ok: false, reason: "empty" }
  }

  if (CONTROL_OR_LINE_BREAK.test(value)) {
    return { ok: false, reason: "invalid-character" }
  }

  if ([...value].length > MAX_CHARACTER_NAME_CODE_POINTS) {
    return { ok: false, reason: "too-long" }
  }

  return { ok: true, value }
}
