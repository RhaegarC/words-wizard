# Feature 34 — Free Practice

> Priority: Must · Mission 4 · **Status: Specced**
> Depends on: the session engine (features 07–09) and the online commit path (features 23–24).
> Blocks: 35 (the practice hub and route family), 37 (the summary strip).
> Source of truth: [Mission 4 sprint](00-mission-4-sprint.md).

## Summary

Turn the single Practice destination into a hub with three ways to practise, and add a free session
that revisits one already-unlocked pack of the current topic.

Free Practice is a real session, not a sandbox: it uses the existing scheduler, XP, streak and
commit path. What makes it different is the word set — the child chooses one pack and practises
only the words already introduced in it, so it never introduces new words and never changes what
the daily plan will offer.

## User story

As a **child**, I want to practise a pack I have already met again, without waiting for the daily
plan, so I can get better at those words. As a **teacher or parent**, I want free practice to be
real practice — it should count — while the daily new-word pace stays unchanged.

## Design

### Practice hub

- The Practice nav item opens **`#/session/hub`**. It presents three cards:
  - **Daily session** → `#/session` (the existing landing and session family, unchanged).
  - **Free Practice** → `#/session/free` (the pack picker).
  - **Topic Exam** → `#/session/exam` (feature 35; the card is disabled with gate progress until
    the exam is available).
- Home's primary Practice button continues to open the one-tap daily flow at `#/session`. The hub
  is the navigation-level choice; Home stays a one-tap start.
- The hub reads content and progress at render, never at module scope (the content bundle is
  fetched during boot).

### Pack picker

- The picker lists only the **current topic**, and only its **unlocked** packs: the first pack is
  always open; each later pack opens when every word of the previous pack has an introduction.
- Exactly **one** pack is selected per free session. The picker shows each pack's
  `introduced / total` count and disables a pack with nothing introduced yet.
- Empty states: no unlocked pack (should be impossible in normal use) and no introduced words in
  the selected pack. Both offer a route back to the daily session.
- The selection is carried in the route (for example `#/session/free/:packId`) so a reload resumes
  the same pack.

### Builder

Add a pure `buildFreePractice` beside the existing daily and monthly builders:

- Inputs: profile, content packs and words, progress, introductions, the chosen `packId`, the
  session seed, and speech availability.
- Reject a pack that is not in the current topic or is not unlocked.
- Select the pack's words **in pack position order**, keeping only words that have an
  introduction row for `(packId, wordId)` and still exist in the content bundle. No introduction is
  written, so no intro card is shown.
- Entries use the `review` word kind and run through `assignSessionWords`, so all five modes rotate
  (listen-choose drops out when no English voice is available) and the order is deterministic for
  the seed.
- Cap the session at **40 words** — the server's per-commit row limit — even though packs are
  currently 20 words and pack size is not bounded by the schema. The cap is stated in the UI copy
  and tested.
- The seed is `sessionSeed(profile.id, now, "free", contentVersion)`; the session id includes the
  kind and the pack so two free sessions cannot collide.

### Session kind and migration

- Add `"free"` to `SessionKind`, `SESSION_KINDS` in the shared payload validator, and the
  `sessions.kind` enum/check in Drizzle.
- SQLite cannot alter a `CHECK` in place, so migration **0003** rebuilds `sessions` while preserving
  every row, the `(user_id, id)` primary key, the `kind IN ('daily','monthly','free')` check, and
  the composite target used by `session_metrics`. Review the generated recreate by hand and run
  `PRAGMA foreign_key_check` in the migration test.
- Rollout order: apply 0003 before the client sends a free session. A queued outbox payload written
  by an older client is unaffected because its kind is already stored in the payload.
- Fallback if a table rebuild is rejected at review: reuse `"daily"` and record free sessions via a
  dedicated metric. That loses per-kind session history, so the migration route is the plan.

### Provider and routes

- `SessionProvider` derives `kind`: `monthly` for review routes, `free` for free routes, otherwise
  `daily`.
- Add the free route family: `session-hub`, `session-free`, `session-free-exercise`,
  `session-free-summary`, carrying `packId` on every phase. Update the exhaustive route records
  (`Route`, `SIMPLE_HASHES`, `TITLE_KEYS`, `ROUTE_SAMPLES`, `parentOf`), `App.tsx`'s screen map and
  `inSession` list, and `AppShell.activeNav`.
- The provider remounts when the pack changes; the leave guard treats the free family like the
  daily family (forward hashes are allowed, anything else confirms).
- Reuse `SessionExerciseScreen` and `SessionSummaryScreen`; the summary is the normal XP, stage,
  streak and Care Token summary with a Free Practice title.

### Accounting

- Commit through the existing `POST /v1/me/sessions` path. Free falls through `buildSessionCommit`
  unchanged: strength and next-review updates, answer XP, the +5 completion bonus, streak,
  `completedSessions`, Care Token cadence and the normal metrics.
- **Invariant:** a free session produces no new progress rows and `word.learned = 0`, because every
  chosen word already has a progress row. Add a defensive assertion in the builder and a test for
  it.
- The daily builder keys "learned today" off `Progress.firstSeenAt`; since free practice creates no
  row, today's new-word plan is untouched.

## Acceptance criteria

- [ ] The Practice nav opens the hub; Daily, Free Practice and Topic Exam are all reachable.
- [ ] The picker shows the current topic's unlocked packs, one selectable, with introduced/total
      counts; a pack with no introduced words is disabled.
- [ ] A free session contains only introduced words from the selected pack, in pack order, capped
      at 40.
- [ ] All five modes rotate deterministically; listen-choose is omitted without an English voice.
- [ ] No introduction card appears, and the commit adds no introduction rows.
- [ ] The commit writes progress deltas, answer XP, +5 completion XP, streak, completed sessions and
      Care Token cadence exactly as a daily session does.
- [ ] `word.learned` stays 0 and no new progress row is created; today's daily plan is unchanged.
- [ ] The session survives a reload on the same pack and stays inside its own route family.
- [ ] `sessions.kind = "free"` persists and a replayed commit is idempotent.
- [ ] The hub, picker and summary read content at render time.

## Test plan

- **Unit** — builder rejects a locked/foreign pack; selects introduced words only, in position
  order; caps at 40; assigns rotating modes and drops listen without a voice; writes no
  introductions. Route parsing and round-trips for the free family.
- **Model** — `SessionKind` includes `free`; the Drizzle check and generated SQL match.
- **Database** — migration 0003 applies to a real D1 engine, preserves existing session rows, and
  accepts `free` while rejecting an unknown kind; `foreign_key_check` is clean.
- **Host** — commit a free session through the real Worker and D1: progress deltas and XP apply,
  `word.learned` stays 0, no introduction row is added, and a replay is idempotent.
- **Page** — the picker's enabled/disabled/empty states; the provider's free branch and leave
  guard; the summary title; i18n key parity.
- **Manual** — complete a daily session, note tomorrow's plan, run a free session, and confirm the
  next daily plan is unchanged.

## Documentation impact

PRD §5.2, §7.7 (new), §8.3, §13, §14 and Appendix A; README's feature list and status; privacy
(free practice is ordinary session history); `docs/develop/page.md` and `worker.md` when the routes
and the session kind land.

## Risks

- The `sessions.kind` check requires a SQLite table rebuild; the migration must preserve the
  `session_metrics` foreign key. This is the most delicate part of the feature.
- Pack size is not bounded by the schema; the 40-word cap is what keeps the commit under
  `MAX_COMMIT_ROWS`.
- The hub adds a click before the daily session for nav users while Home keeps a one-tap start; the
  product copy must make the three choices obvious.

## Out of scope

Selecting several packs at once; choosing individual words; practising a pack from another topic;
practising unintroduced words; a separate XP or streak rule for free practice; changing the daily
session builder.
