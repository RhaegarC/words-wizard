# Feature 18 — Spelling-First Five-Mode Practice & 10-Word Sessions

> Priority: Must · Mission 1 · **Status: In progress — implemented, PR review pending**
> Depends on: 07 (session builder), 08 (practice modes)

## Summary

Spelling is the skill the app exists to build, but the daily builder treats all five
practice modes equally: a new word receives any two of them, so it can be introduced,
matched, and reviewed without ever being built. This feature makes every new word run
through **all five modes in a fixed order**, starting with the spelling builder.

At the same time the daily new-word count rises from **4 to 10**. Reviews stay capped at
five, so a full session is 10 intro cards + 50 exercises + 5 reviews (**65 screens**),
and the no-speech shape is 10 intros + 40 exercises + 5 reviews (**55 screens**).

This is a deliberate PRD decision change. It supersedes the v0.2 promise of a 6–8 minute,
9-word, 17-screen session (PRD §5 and Decision Log row 3).

## User story

As a child, I meet every new word five different ways — starting by building it myself —
so it sticks before I move on. As a parent, I understand that a daily session is now a
longer commitment, but no new word is introduced without full practice.

## Acceptance criteria

- [x] `config.session` is `{ reviewCap: 5, newWords: 10, newWordModes: [...], maxWords: 15 }`;
      `newWordExercises` is gone, so the ordered tuple is the single source of count and order.
- [x] Every new word receives all five modes in the fixed order: `spellingBuilder` →
      `fillBlank` → `wordToMeaning` → `pictureMatch` → `listenChoose`.
- [x] Every review word receives exactly one mode; the review rotation is deterministic and
      lands the last review clear of the spelling builder that opens the next new word.
- [x] Monthly review still gives exactly one exercise per selected word.
- [x] With no English voice, `listenChoose` is filtered out and each new word gets four
      exercises; the session remains completable.
- [x] A full daily session is 65 screens / 15 words / 55 exercises; the no-speech shape is
      55 screens / 45 exercises.
- [x] The landing screen's duration is derived from the plan rather than hard-coded
      ("About 30 minutes" at the full shape, "大约 30 分钟" in Chinese).
- [x] Preview counts still report up to 5 reviews and up to 10 new words.
- [x] PRD §5, §7.6, §12, Decision Log row 3, and the sprint Definition of Done are updated.
- [x] `pnpm test`, `pnpm typecheck`, `pnpm validate:content`, and `pnpm build` pass.
- [x] Manual browser run confirms the order and counts; with the speech API disabled, the
      session falls back to four exercises per new word (verified 2026-10-22 in headless Edge).

## Tasks (ordered)

1. Replace `config.session.newWordExercises` with the ordered `newWordModes` tuple; raise
   `newWords` to 10 and `maxWords` to 15.
2. Rewrite mode assignment: fixed sequence for new words, one rotated mode for reviews;
   remove shuffle/RNG from assignment.
3. Derive the landing duration from `screenCount` via `estimatedMinutes`.
4. Update locale copy and the config/session/monthly-review tests.
5. Update the PRD, sprint index, and this feature file.

## Tests

**Unit (Vitest):** config caps and tuple order; every new word's exact five-mode sequence;
review rotation length and determinism; no-speech four-mode sequence; 65/55-screen and
55/45-exercise arithmetic; 110/90 answer XP; a new word completing after five exercises;
`estimatedMinutes` rounding; monthly review unchanged at one exercise per word.

**Verification (manual, 2026-10-22, headless Edge):** the landing reported 10 new words and
"About 25 minutes"; the first word ran Build the word → Fill the blank → Choose the meaning →
Match the picture → Listen and choose (progress 1–5 of 50). With `speechSynthesis` unavailable,
the same start showed "1 of 40" and ran only the four non-listening modes before the next
word's intro. The full five-review / 65-screen shape and the summary counts are covered by
the unit tests rather than this run.

## Non-goals

- No change to the `PRACTICE_MODES` registry order or the internals of any mode module.
- No mid-session saving, resumability, or session chunking.
- No XP, mastery, review-interval, or pack-unlock rebalance.
- No cross-pack new-word filling.
- No rewrite of archived feature 07, which records the shape that shipped before this change.

## Risks

- **Long sessions and lost progress.** 65 screens is roughly 30–40 minutes, and the session
  still commits only at the end; abandoning it loses everything. Resumability is a follow-up.
- **Faster mastery and XP inflation.** Five correct attempts per new word satisfy mastery in
  the same session, so a perfect 10-word session also earns mastery XP for every word. XP
  balance is unchanged here and should be reviewed separately.
- **Pack supply.** Ten new words per session exhaust a 20-word pack in two sessions, and
  selection still fills from one pack only, so a session near a pack's end can be short.
- **Every mode must be playable for every word.** Fill-the-blank needs the target in the
  first example; picture and listening modes need viable options. The content validator and
  the manual run are the guards.
