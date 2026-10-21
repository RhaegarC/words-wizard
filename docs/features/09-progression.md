# Feature 09 — Progression: Session Commit, XP, Streak, Care Tokens, Summary

> Priority: Must · Mission 1 · **Status: In progress — implemented, pending merge**
> Depends on: 05, 07, 08

## Summary

Turn a `SessionResult` into one atomic write and one honest summary. This is where SM-2-lite,
mastery, XP, stage, streak, and the Care Token ledger meet. Every rule here is a pure function with
boundary tests; the only impure step is the transaction wrapper from feature 05.

The session commits **once**, at the end. There is no per-answer write.

## User story

As a **child**, finishing a session feels like progress: words I got right grow stronger, my buddy
grows, my streak continues, and my summary tells me what I earned. As a **parent**, closing the tab
mid-session never leaves a half-updated record.

## Acceptance criteria

### Per word

- [x] Each attempt applies its scheduler delta immediately in the computed result: correct
      `strength += 0.2` (cap 1.0), wrong `strength -= 0.3` (floor 0). A wrong then correct exercise
      therefore nets `-0.1`, per PRD §5.3/§9.
- [x] `wrongCount` increments once per wrong tap; `correctCount` increments on a correct answer even
      after hints.
- [x] `nextReviewAt = now + intervalDays(finalStrength)`, where intervals are
      **1 / 2 / 4 / 7 / 14 / 30** days.
- [x] `status` becomes `mastered` when `strength >= 0.8 && correctCount >= 3`; it reverts to `learning`
      at `strength < 0.5`. There is no `0.3` "needs practice" state.
- [x] A word is learned when it has a `Progress` row; the row is created for every word attempted in a
      session that completes, including a revealed word.
- [x] `firstSeenAt` is preserved on update; `lastSeenAt = now`.
- [x] Mastery XP **+10** is awarded only on the first transition to mastered;
      `masteryXpAwarded` is set and never cleared by demotion or re-mastery.

### Session

- [x] XP in memory: first-try correct **+2**, correct after hint **+1**, revealed **0**; plus **+5**
      for completing the session.
- [x] Stage is derived from cumulative XP with thresholds `0 / 50 / 300 / 900 / 2000`; no stage is
      stored.
- [x] Streak uses the **local calendar day**: same day → unchanged; a gap of 1–7 days → `streakCount + 1`
      (missed days pause, they do not add); a gap greater than 7 days or no previous date → `1`.
      `bestStreak = max(bestStreak, streakCount)`.
- [x] `lastPracticeAt = now`, `frozenDays = 0`, and `completedSessions += 1` on every completed
      session (daily or monthly).
- [x] Care Tokens: `sessionsSinceLastToken += 1`; at 5, if `careTokens < 3` then `careTokens += 1`
      and the counter resets to 0; at the cap the counter holds at 5. See feature 10 for spending.
- [x] The whole commit is one Dexie transaction: all progress rows, the profile patch, metrics, and
      device flags succeed or none do.
- [x] The summary shows words practiced, words mastered this session, XP earned, stage before/after
      with a progress bar, streak, and Care Token progress (`sessionsSinceLastToken` of 5).
- [x] A double submit cannot commit twice; the commit button disables on first activation and an
      in-memory guard rejects a second payload for the same session id.
- [x] Metrics recorded: session completed, words learned, words mastered, stage-ups, XP earned.
- [x] Abandoned sessions record `abandon` only (a session-start metric) and commit no progress.

## Tasks (ordered)

1. Implement `applyAttempt(progress, correct)` — pure; caps/floors and counts.
2. Implement `intervalDays(strength)` and `nextReviewAt(strength, now)`.
3. Implement `resolveStatus(progress)` — mastery and demotion rules.
4. Implement `awardXp(result)` — per-exercise XP and the session bonus.
5. Implement `deriveStage(xp)` and `stageProgress(xp)` — shared with feature 10.
6. Implement `calcStreak(profile, todayKey)` using the shared `daysSinceLocal` helper.
7. Implement `applyCareTokenGrant(profile)` — the 5-session cadence and cap.
8. Implement `buildSessionCommit(result, profile, existingProgress, now)` — the full payload, including
   mastery XP, `masteryXpAwarded`, and metric deltas.
9. Implement `commitSessionResult()` calling feature 05's transaction with the payload.
10. Build the Session Summary screen and its stage/streak/token visuals.
11. Wire `#/session/summary` to the result; block back-navigation into a committed session.
12. Add i18n keys for every summary line and the "all caught up" path.
13. Record the abandoned-session metric on the confirmed exit path from feature 07.

## Tests

**Unit (Vitest):**

- `applyAttempt` — 0 → 0.2 → 0.4; cap at 1.0; 0 → 0 (floor); wrong then correct nets -0.1; counts.
- `intervalDays` — each strength band maps to the documented interval; boundaries 0, 0.2, 0.4, 0.6,
  0.8, 1.0.
- `resolveStatus` — 0.8/3 correct → mastered; 0.8/2 correct → learning; 0.79/10 → learning;
  0.49 → demoted; 0.5 stays learning; a demoted word does not lose `masteryXpAwarded`.
- `awardXp` — first try 2, after hint 1, revealed 0, session +5, mastery +10 once.
- `deriveStage` — 0/49/50/299/300/899/900/1999/2000 and far above.
- `calcStreak` — same day, next day, gap 2, gap 7, gap 8, null previous date; best streak retained.
- `applyCareTokenGrant` — sessions 1–4 no token; 5 → token; at cap counter holds at 5; after a spend
  the next session grants; never more than 3.
- `buildSessionCommit` — first-seen preserved; new words get rows; a revealed word is learned;
  `nextReviewAt` from final strength; `firstSeenAt`/`lastSeenAt`; profile patch fields.
- Idempotency — the same session id is rejected the second time.

**Verification (manual, real IndexedDB):**

- Complete a session, reload, and confirm every word's strength/status and the profile XP/streak/
  tokens.
- Force a throw inside the transaction and confirm nothing changed.
- Two rapid taps on "Finish" produce one summary and one commit.

## Non-goals

- No per-answer persistence, no resume.
- No XP for opening the app, browsing, or changing settings.
- No badges or level titles beyond the five stages.
