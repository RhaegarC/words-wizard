# Feature 07 — Session Engine

> Priority: Must · Mission 1 · **Status: Not started**
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

- [ ] A session is at most **9 words**: up to **5 due reviews**, one exercise each, plus up to **4 new
      words**, each with an introduction card and **two exercises in different modes**.
- [ ] Reviews are words with `status` `learning` or `mastered` and `nextReviewAt <= now`, ordered by
      `nextReviewAt` ascending, capped at 5; reviews may come from any topic.
- [ ] New words come from the **lowest-order unlocked pack** in `Profile.currentTopicId` with
      unlearned words; pack 1 is always unlocked, pack 2 at 15 mastered in the topic, pack 3 at 30.
- [ ] A word is "unlearned" when it has no `Progress` row; a word from an abandoned session is still
      new.
- [ ] The builder dedupes by `wordId`, caps at 9, and returns an empty result when there is nothing
      due and nothing new; the caller shows the caught-up state.
- [ ] Mode assignment is deterministic for the same `(profileId, local date, kind, content version)`:
      two distinct modes for each new word, one mode for each review word, no same mode on back-to-back
      words where an alternative exists.
- [ ] The **feedback ladder** is exact: first miss → hint 1 (remove a distractor or show the first
      letter); second miss → hint 2 (word shape or meaning); third miss → reveal the answer and require
      a confirming tap. The word "wrong" never appears in copy.
- [ ] Every wrong tap is counted per exercise; a later correct answer still counts as correct for
      `correctCount`, per PRD §5.3.
- [ ] XP accrues in memory only: first-try correct **+2**, correct after any hint **+1**, revealed
      **0**. Nothing is written to Dexie during the session.
- [ ] The intro card appears for new words only and shows word, IPA, image, part of speech, meaning
      and definition in the active locale, and the paired example; pronunciation is tap-to-hear, never
      autoplay.
- [ ] Leaving mid-session shows a confirmation; confirming discards the entire session and writes
      nothing. Browser-kill loss is accepted and documented.
- [ ] The session host exposes a `beforeLeave` veto to the router so browser back and the header back
      arrow both hit the same confirmation.
- [ ] If no English voice exists, the mode assignment excludes *listen & choose* in favour of
      *word → meaning* or *spelling builder* (feature 08 supplies availability).
- [ ] Maximum 17 screens for a full session (4 × (intro + 2 exercises) + 5 reviews).

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

## Non-goals

- No per-answer persistence, no resume-after-kill.
- No timers, no scoring streaks inside a session, no leaderboard.
- No Monthly Review builder (feature 13 reuses this engine with `kind: 'monthly'`).
