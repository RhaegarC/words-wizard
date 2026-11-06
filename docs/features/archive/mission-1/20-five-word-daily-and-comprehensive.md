# Feature 20 — Five Words a Day & Comprehensive Practice

> Priority: Must · Mission 1 · **Status: Done — merged in PR #47**
> Depends on: 07, 08, 09, 12, 18

## Summary

Four product changes to the daily practice loop:

1. **A daily set is five new words, and no more.** The session no longer mixes in
   a daily review block. Those five words are fixed for the local calendar day:
   abandoning the session and returning offers the same five, and after the set
   is committed the same five remain available as extra practice. No new words
   are introduced until the next local day.
2. **Each new word is practised by spelling only.** The introduction card is
   followed by one spelling-building exercise. After all five words, a
   **Comprehensive Practice** block runs one randomly chosen mode per word in a
   shuffled order. Spelling is not in that pool, because repeating the exercise
   the child has just done adds no new evidence.
3. **The learning card shows the Chinese translation beside the word**, for
   example `box 盒子`.
4. **Meaning and definition are bilingual everywhere.** The introduction card
   and Word Detail show both the English and the Chinese versions regardless of
   the UI language, reversing feature 19's English-only detail rule.

## User story

As a child, I learn five new words a day rather than facing a long mixed session.
I meet each word, build it once, and then a short mixed quiz checks that I know
it in more than one way. I can see what each English word means in Chinese on
the card, and a Chinese-speaking parent can read the explanation in Chinese even
when the interface is in English.

## Acceptance criteria

- [x] The daily plan selects at most five new words from the lowest unlocked
      pack in the current topic and contains no daily review entries.
- [x] Every new word's plan entry has exactly one mode, `spellingBuilder`.
- [x] After the five spelling words, the plan contains one `comprehensive`
      entry per word, each with one mode drawn from the four non-spelling modes
      (three when no English voice exists), in a deterministic shuffled order.
- [x] The whole plan is deterministic for the same profile, local day, kind, and
      content version; an abandoned session rebuilds the same five words and the
      same comprehensive modes.
- [x] Once a daily session has committed today, the builder offers today's five
      words as `repeat` entries — spelling plus comprehensive, no introduction
      cards — instead of introducing new words; a fresh set arrives on the next
      local day.
- [x] The session result has one row per distinct word, aggregating that word's
      spelling and comprehensive attempts, so the commit applies each word's
      scheduler delta once.
- [x] The spelling board keeps the completed word visible through the feedback
      panel, and clears only when a retry re-enables it.
- [x] A chosen option keeps its highlight after selection, including while the
      feedback panel is showing.
- [x] The introduction card shows the word text followed by `meaningZh`, and
      shows meaning and definition in both English and Chinese.
- [x] Word Detail shows meaning and definition in both languages; surrounding
      labels remain localized.
- [x] The comprehensive exercises carry a distinct badge, and the landing
      estimate reflects the 15-screen shape (about 10 minutes).
- [x] Monthly Review is unchanged: up to 20 learned words, one exercise each.
- [x] `pnpm test`, `pnpm typecheck`, `pnpm validate:content`, and `pnpm build`
      pass.
- [x] A manual browser run confirms five words, five spelling exercises, five
      comprehensive exercises, the Chinese translation, and bilingual
      explanations in both UI languages.

## Tasks (ordered)

1. Update `config.session`: five new words, spelling as the only per-word mode,
   and no daily review/max-word pair. The comprehensive pool is the practice-mode
   registry minus the per-word modes, filtered by speech.
2. Rework `buildSession`/`previewSession`: no daily reviews, five new words, one
   spelling entry each, then a seeded comprehensive block.
3. Derive the same-day set from progress rows whose `firstSeenAt` falls on
   today's local date, and return it as `repeat` entries without intros.
4. Deduplicate `buildSessionResult` rows by `wordId` and aggregate attempts.
5. Add the comprehensive and repeat badges, the Home practice-again card, and
   landing copy; update locale files.
6. Keep the spelling board's letters visible through feedback and clear them
   only on retry.
7. Keep a chosen option highlighted after selection.
8. Make the introduction card's word heading and meaning/definition bilingual.
9. Make `buildWordDetail` and Word Detail bilingual.
10. Update tests, the PRD, and the sprint index; run the full verification suite.

## Tests

**Unit (Vitest):** five new words and no daily reviews; one spelling mode per new
word; comprehensive entries cover each word exactly once with a non-spelling
mode; seeded determinism; speech fallback removes listen-and-choose; same-day
completion yields a five-word `repeat` plan with no intros and a 10-screen
count; today's words from another topic leave the day caught up; a fresh day
resumes new-word selection; one result row per distinct word with both attempts
aggregated; the full session has 15 screens, five result rows, ten attempts, and
20 answer XP; `buildWordDetail` exposes both languages; config literals match the
new shape.

**Verification (manual, 2026-10-23, headless Edge):** the landing reported
"5 new words", "Comprehensive practice", and "About 10 minutes"; the first card
read `box 盒子` and showed both English and Chinese meanings and definitions.
The run advanced through exercises 1–10 of 10, with NEW badges on the spelling
block and COMPREHENSIVE badges on the shuffled block, then the summary reported
"5 words practiced". Word Detail showed both languages. The completed spelling
letters remained visible through all 13 checked feedback panels, a retry cleared
them, and a chosen option stayed highlighted in all 13 choice exercises. Home
then offered "Practice again" for the same five words; the repeat landing read
"5 words to practice again" and "About 5 minutes", started directly at the first
exercise (no introduction cards), showed a PRACTICE badge, and reported "1 of
10". The run recorded zero console exceptions. UI language switching and reload
determinism are covered by the unit tests rather than this run.

## Non-goals

- No daily spaced-repetition review block. Monthly Review remains the review
  surface.
- No mid-session saving or chunking; the session still commits at the end.
- No changes to content data, content validation, XP rates, or the monthly
  review selector.
- No persistence of the daily set beyond the existing progress rows; the set is
  derived, not stored.

## Risks

- **Review exposure falls sharply.** Without a daily review block, learned words
  are revisited only through Monthly Review. The scheduler still records strength
  and `nextReviewAt`, but nothing consumes the due queue outside that review.
- **Extra practice is a full session.** Each same-day repeat earns XP and counts
  toward the streak and Care Tokens, so a child can keep earning by replaying the
  same five words. The daily word-introduction cap is unaffected.
- **Comprehensive modes are random.** Two words can receive the same mode, and a
  mode may repeat across adjacent exercises; the evidence is one exercise per
  word, not one of each mode.
