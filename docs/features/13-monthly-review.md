# Feature 13 — Monthly Review

> Priority: Must · Mission 1 · **Status: Not started**
> Depends on: 07, 08, 09, 11

## Summary

A retention check every 28 days: up to 20 learned words, one exercise each, reusing the five modes.
It is offered, never imposed, and its summary reports "strong" versus "wants another visit" — never
"forgotten".

## User story

As a **child**, every month or so the app asks whether the words I learned are still there, in the
same game-like way. As a **parent**, I can see retention without a test or a score.

## Acceptance criteria

- [ ] **Trigger:** due when at least 28 **local calendar days** have passed since
      `lastMonthlyReviewAt` and at least **5 words are learned**. If no review has ever run, the clock
      starts at the `firstSeenAt` of the **fifth learned word** (sorted by `firstSeenAt`); no extra
      stored field is added.
- [ ] The Home card appears only when due, is never blocking, and routes to `#/review`.
- [ ] **Scope:** 5–19 learned words → review all. At 20 or more, select 20:
      1. take 17 by lowest `strength`, then oldest `lastSeenAt`;
      2. add up to 3 **high-strength confirmations** (`strength >= 0.8`) not already selected;
      3. fill any remainder from the oldest `lastSeenAt`.
- [ ] Each selected word gets exactly one exercise; modes are assigned deterministically from the
      review seed (feature 07's algorithm), with no intro cards and no new words.
- [ ] The review reuses the session host, feedback ladder, speech fallback, and exit confirmation.
- [ ] On completion:
  - each word's strength and counts update with the same SM-2-lite rules as a daily session;
  - words below `strength < 0.5` are demoted;
  - `nextReviewAt` is recomputed from the final strength;
  - `lastMonthlyReviewAt = now`;
  - the review counts as a completed session for XP, `lastPracticeAt`, streak, Care Tokens, and
    `completedSessions` (PRD §7.4 is a session, not a separate economy).
- [ ] The review summary shows "You reviewed X words. Y still strong, Z want another visit."
      **Strong** is `strength >= 0.8` after the review. The copy never says "forgot" or "wrong".
- [ ] Abandoning the review commits nothing, including `lastMonthlyReviewAt`; the card remains due.
- [ ] `#/review/summary` cannot be reached without a committed review; back does not re-enter it.
- [ ] Metrics: reviews offered, reviews completed, average strength delta.

## Tasks (ordered)

1. Implement `isMonthlyReviewDue(profile, progress, now)` — both branches (reviewed before / never
   reviewed), the 5-word minimum, and the fifth-word origin.
2. Implement `selectReviewWords(progress, words, cap)` — the 17 + 3 + fill rule, deterministic ties
   broken by `wordId`.
3. Add `buildReview(profile, progress, content, now, seed)` returning a `SessionResult` with
   `kind: 'monthly'`, one exercise per word, no intros.
4. Route `#/review` through the feature 07 host.
5. Extend `buildSessionCommit` with the monthly branch: `lastMonthlyReviewAt` and review metrics.
6. Build `#/review/summary` with strong/needs-a-visit counts.
7. Mount the Home card through `buildHomeView` (replace the stub from feature 11).
8. Record the offered metric when the card renders as due, and completed on commit.
9. Add i18n keys, including the tone guardrail copy.
10. Manual run with 5, 12, 19, 20, and 35 learned words on a seeded profile.

## Tests

**Unit (Vitest):**

- `isMonthlyReviewDue` — 27/28 days; 4/5 learned; never reviewed with the fifth word 27/28 days ago;
  a review 30 days ago with 3 learned words → not due; exactly 5 learned at the boundary.
- `selectReviewWords` — 5 words → all; 19 → all; 20 → 17 low-strength + 3 high-strength; 35 → the 20
  per the rule; fewer than 3 high-strength → fill from oldest; ties deterministic; no duplicates;
  cap never exceeded.
- Review commit — strength deltas, demotion, `nextReviewAt`, `lastMonthlyReviewAt`; abandoned review
  leaves it unchanged; review counts as a completed session and a streak day.
- Summary counts — strong at `>= 0.8`, wants another visit below; the two add to the total.
- Mode assignment — same seed reproduces the same review.

**Verification (manual):**

- Seed 20 learned words, set the clock 28 days forward: home card appears.
- Complete the review: summary counts match Word Book strength; `lastMonthlyReviewAt` persists.
- Abandon after five words: no state change; the card is still there.
- With 4 learned words, the card never appears.

## Non-goals

- No scheduled notifications or background review.
- No monthly report for parents, no export of review history.
- No second review type (weekly, per-topic).
