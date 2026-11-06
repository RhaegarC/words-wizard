# Feature 07 — Session Engine

> Priority: Must · Mission 1 · **Status: Done — merged in PR #17**
> Depends on: 04, 05, 06

## Summary

The core loop: choose up to 5 due reviews and up to 4 new words, assign each word its exercises,
run the intro → exercise → feedback sequence, and produce a `SessionResult` that feature 09 commits
in one transaction. Nothing is written during the session; leaving discards it after a confirmation.

The engine is a pure state machine plus a thin screen host. The builder, mode assignment, hint
escalation, and scoring are unit-tested without a browser; the screens are verified manually.

## User story

As a **child**, I tap Practice and get a short, fair set of words: some I have met before and a few
new ones, with hints when I get stuck. As a **parent**, leaving halfway never leaves half-finished
progress behind.

## Acceptance criteria

- [x] A session is at most **9 words**: up to **5 due reviews**, one exercise each, plus up to **4 new
      words**, each with an introduction card and **two exercises in different modes**.
- [x] Reviews are words with `status` `learning` or `mastered` and `nextReviewAt <= now`, ordered by
      `nextReviewAt` ascending, capped at 5; reviews may come from any topic.
- [x] New words come from the **lowest-order unlocked pack** in `Profile.currentTopicId` with
      unlearned words; pack 1 is always unlocked, pack 2 at 15 mastered in the topic, pack 3 at 30.
- [x] A word is "unlearned" when it has no `Progress` row; a word from an abandoned session is still
      new.
- [x] The builder dedupes by `wordId`, caps at 9, and returns an empty result when there is nothing
      due and nothing new; the caller shows the caught-up state.
- [x] Mode assignment is deterministic for the same `(profileId, local date, kind, content version)`:
      two distinct modes for each new word, one mode for each review word, no same mode on back-to-back
      words where an alternative exists.
- [x] The **feedback ladder** is exact: first miss → hint 1 (remove a distractor or show the first
      letter); second miss → hint 2 (word shape or meaning); third miss → reveal the answer and require
      a confirming tap. The word "wrong" never appears in copy.
- [x] Every wrong tap is counted per exercise; a later correct answer still counts as correct for
      `correctCount`, per PRD §5.3.
- [x] XP accrues in memory only: first-try correct **+2**, correct after any hint **+1**, revealed
      **0**. Nothing is written to Dexie during the session.
- [x] The intro card appears for new words only and shows word, IPA, image, part of speech, meaning
      and definition in the active locale, and the paired example; pronunciation is tap-to-hear, never
      autoplay.
- [x] Leaving mid-session shows a confirmation; confirming discards the entire session and writes
      nothing. Browser-kill loss is accepted and documented.
- [x] The session host exposes a `beforeLeave` veto to the router so browser back and the header back
      arrow both hit the same confirmation.
- [x] If no English voice exists, the mode assignment excludes *listen & choose* in favour of
      *word → meaning* or *spelling builder* (feature 08 supplies availability).
- [x] Maximum 17 screens for a full session (4 × (intro + 2 exercises) + 5 reviews).

## Tasks (ordered)

1. Define `Session` state: `idle | intro | exercise | feedback | complete`; session-level word queue;
   per-word exercise list and cursor.
2. Implement `buildSession(input)` — pure; inputs are `profile`, `progressRows`, `content`, `config`,
   `now`, and a seed; output is `{ words: SessionWord[], caughtUp: boolean }`.
3. Implement pack unlocking: mastery count in the topic, then the first unlocked pack with an
   unlearned word, in `order`.
4. Implement seeded mode assignment: hash the seed, shuffle the five modes, walk the word queue, and
   enforce the distinct/back-to-back rules.
5. Implement the per-exercise attempt model: `hintLevel` 0–2, `wrongTaps`, `revealed`, `firstTry`,
   `xp`, and the derived feedback copy key.
6. Implement the state transitions: start → next word → intro (new) → exercise → feedback →
   next exercise or next word → complete. Add a pure reducer with unit tests.
7. Build the Session Intro screen: word counts, "about 7 minutes", Start.
8. Build the Word Introduction card.
9. Build the exercise host that renders the module chosen for the current exercise and wires answers
   back into the reducer.
10. Build the Feedback overlay: encouraging copy, hint presentation, reveal + confirming tap.
11. Implement exit confirmation and the router veto; confirm discards.
12. Produce `SessionResult` on completion (attempts, per-word first-attempt flag, XP, timestamps,
    `kind: 'daily'`) and hand it to `#/session/summary`.
13. Add the caught-up state for an empty session.
14. Add i18n keys for all session and feedback copy.

## Tests

**Unit (Vitest):**

- `buildSession` — 5 reviews + 4 new at the caps; fewer when the queue is short; dedupe by wordId;
  never exceeds 9; reviews ordered by `nextReviewAt`; empty → `caughtUp`.
- Pack unlocking — 14 mastered keeps pack 2 locked; 15 opens it; 29/30 for pack 3; a fully learned
  pack 1 moves to pack 2, never to a locked pack.
- New-word selection — a word with any `Progress` row is not new; a word repeated in a pack appears
  once.
- Mode assignment — same seed → same assignment; every new word gets two distinct modes; a review
  gets one; no avoidable back-to-back repeat; *listen & choose* absent when speech is unavailable.
- Feedback ladder — attempt 1/2/3 outcomes produce hint 1, hint 2, reveal; reveal requires a
  confirming tap; no copy contains "wrong".
- Scoring — first-try +2; correct after hint 1 or 2 +1; revealed 0; a wrong tap does not award XP.
- Reducer — full 9-word session ends in `complete`; exit from any phase discards with zero writes.

**Verification (manual):**

- Run a full session on iPad Safari; count the screens (≤ 17).
- Close the tab mid-session, reopen: no partial progress (feature 09's commit never ran).
- Repeat the same day on the same device: the mode order is stable.

## Implementation notes

- `src/domain/random.ts` — FNV-1a seed hash, mulberry32 RNG, and a non-mutating Fisher–Yates
  shuffle. Same seed, same assignment.
- `src/domain/session.ts` — `buildSession`, `previewSession`, `screenCount`, the attempt model
  (`answerAttempt`, `confirmRevealAnswer`), the reducer, and `buildSessionResult`. No React, no store.
- `src/session/SessionProvider.tsx` — one session per visit to the session routes: reads progress
  once, builds the plan, registers the `beforeLeave` veto, mirrors the phase onto the fragment, and
  renders the exit confirmation above the shell. It only reads the store.
- Screens: session landing (counts or caught-up), introduction card, exercise host, summary.
- `src/speech.ts` — tap-to-hear, and `resolveSpeechAvailability` decides whether *listen & choose* may
  be planned. An empty voice list (iOS before the first utterance) is treated as supported;
  `voiceschanged` refreshes the flag, and the plan is rebuilt only before Start.
- `LeaveGuard` now passes the destination hash to the handler. The session allows only the forward
  moves it makes itself (`intro → exercise`, `exercise → summary`); everything else, including
  returning to `#/session`, asks first.

### The exercise-host seam

Feature 08 owns the five practice modes. The host built here renders a temporary self-check body
(mode label, artwork, word, "I know it" / "Not yet") and already owns everything around it: the
planned mode, progress, the answer callbacks, hints and reveal. A feature-08 module replaces only the
body and calls `dispatch({ type: "answer", correct })`; the ladder and XP are therefore exercised end
to end before any mode is written.

### Not persisted yet

The completed `SessionResult` is exposed by the provider and shown on `#/session/summary`; nothing is
written. Feature 09 consumes the same object and commits it in one transaction, and the summary copy
says so plainly until then.

## Verification

- `pnpm test` — 182 tests, including 34 session-engine tests and 12 across `random` and `speech`.
- `pnpm typecheck` and `pnpm build`.
- Headless Edge against the dev server with a seeded dev profile: landing counts, all four intro
  cards, the full ladder (hint 1 → hint 2 → reveal → confirming tap), two exit destinations
  (`#/session` and `#/home`) with the route held, twelve exercises, a summary showing `+14 XP` and
  4 words, and browser back from the summary corrected to the summary. No console errors or uncaught
  exceptions.
- Still manual: iPad Safari voice behaviour and the on-device screen count.

## Non-goals

- No per-answer persistence, no resume-after-kill.
- No timers, no scoring streaks inside a session, no leaderboard.
- No Monthly Review builder (feature 13 reuses this engine with `kind: 'monthly'`).
