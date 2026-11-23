# Mission 4 — Sprint Goal: "Practice freely, prove mastery, collect the proof"

> Status: **In progress — features 34–37 are done and archived; feature 38 (Profile cleanup and
> database bootstrap) is specced.** Each feature moves to Done as its implementation PR merges.
> Depends on: Mission 2 (features 21–27) and Mission 3 (features 28–31) repository work complete.
> Buddy removal (backlog item 01) is deliberately not part of this mission; Buddy remains a live
> online feature.
> Source of truth: [docs/PRD.md](../PRD.md) as amended by this mission. Where this file and a later
> Mission 4 feature doc disagree, the feature doc wins once its design is locked.

## Goal

Give the child more ways to practise and a visible reason to keep going: revisit one unlocked pack
freely, prove a topic with a staged spelling exam, see each topic's status, and collect medals and
topic trophies from progress the app already records.

The mission adds no new content and no new deployment target. It extends the existing session
engine, the child SPA, the Worker API and D1, and the per-user counters. The admin portal and the
teacher authoring flow are unchanged.

## What already exists to build on

- **The session engine** (features 07–09): daily and monthly plans, deterministic seeds, the five
  exercise modes, the reducer, and `buildSessionResult`.
- **The commit path** (features 09, 23–24): one idempotent `/v1/me/sessions` request that writes
  progress, XP, streak, completed sessions, Care Token cadence, metrics and introductions in one
  D1 batch; the outbox replays a queued commit.
- **Pack unlock** (feature 22): the first pack is open and each later pack opens when every word of
  the previous pack has been introduced. Introductions come from `/v1/me`.
- **Per-user counters** (feature 23): the `metrics` table and `METRIC_NAMES` allowlist already
  carry cumulative words learned, words mastered, sessions completed and monthly reviews.
- **D1 and the Worker** (features 21–23): migrations, validation, the error envelope, and the
  `users.oid` cascade.
- **Exhaustive routing and i18n parity**: new routes must be added to every route record, and every
  new string to both `en.json` and `zh.json`.
- **The documentation convention**: a live sprint index, one design-locked feature doc per
  feature, per-feature archival after merge, and a mission-close PR.

## Locked scope and decisions

| Decision | Answer |
|---|---|
| Practice entry | The Practice nav opens a hub with Daily session, Free Practice and Topic Exam. Topic status appears in the topic picker. |
| Free practice selection | Exactly one unlocked pack of the current topic. |
| Free practice word set | Only words already introduced in that pack. It never introduces words and never consumes the daily new-word quota. |
| Free practice modes | All five practice modes rotate, one mode per word. |
| Free practice accounting | A normal session: strength and next review, XP (including +5 completion), streak, completed sessions and Care Token cadence. |
| Exam word set | Every word in the topic, spelling only. |
| Exam gate | Every distinct word in the topic has an introduction (all packs unlocked). |
| Exam parts | Fewer than 50 words each, balanced, deterministic order, taken in order, resumable. |
| Exam attempt | One clean typed attempt per word; no letter tiles, hints or reveal; a wrong spelling fails the part. |
| Exam failure | Show the missed word and its correct spelling, then retake the part from its first word. Earlier parts stay passed. |
| Exam accounting | Assessment only: no progress, strength, scheduling, XP, streak, completed sessions or Care Token cadence. |
| Completion | Passing every part marks the topic Completed. Retakes are allowed; the topic stays Completed. |
| Content changes | A Completed topic stays Completed. An unfinished exam resets if the topic's content version changes. |
| Topic status | None and Learning are derived from introductions; Completed is persisted by the exam. |
| Badges | 20: 15 medals (five categories × three tiers) plus one trophy per topic. Derived from monotonic facts; no table and no earned dates. |

## Definition of Done

- [ ] The Practice nav opens a hub with Daily, Free Practice and Topic Exam.
- [ ] Free Practice selects one unlocked pack of the current topic, practises only introduced
      words, rotates all five modes, and commits a normal session.
- [ ] A free session creates no introductions and no new progress rows; the daily new-word plan is
      unchanged.
- [ ] The topic exam is available only when every word in the topic has been introduced.
- [ ] Exam parts hold fewer than 50 words, are taken in order, and resume after a reload.
- [ ] One clean typed attempt per word; a wrong spelling fails the part and shows the missed word
      and spelling; earlier parts stay passed.
- [ ] An exam changes no progress, strength, review date, XP, streak, completed-session count or
      Care Token cadence.
- [ ] Passing the last part marks the topic Completed; retakes keep it Completed.
- [ ] Topic status is visible on the topic picker and the hub exam card.
- [ ] The badge catalogue has 20 entries and is derived from monotonic facts; a Home card opens
      the Badges screen; newly earned badges appear on session and exam summaries.
- [ ] Each feature has tests in its tier, and the PRD, privacy notice and feature docs are updated
      with its implementation.
- [ ] Buddy, its avatars, Care Tokens and `/v1/me/care` are unchanged.

## Features

Mission 3 ends at feature 33, so Mission 4 claims **34 onwards** and now includes feature 38.
Features 32–33 remain reserved and deferred by Mission 3.

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 34 | [Free Practice](archive/mission-4/34-free-practice.md) — the practice hub, one unlocked pack, introduced-word sessions, normal accounting | Done | — |
| 35 | [Exam Mode](archive/mission-4/35-exam-mode.md) — all-word topic exams, staged spelling parts, resumable pass state, assessment-only | Done | 34 |
| 36 | [Topic Status](archive/mission-4/36-topic-status.md) — None/Learning/Completed on the topic picker and the hub | Done | 35 |
| 37 | [Badges and achievements](archive/mission-4/37-badges-achievements.md) — 15 medals, one trophy per topic, Home card and Badges screen | Done | 34–36 |
| 38 | [Profile cleanup and database bootstrap](38-profile-cleanup.md) — remove export/diagnostics, move the badge shelf into the Profile page, add the top-right profile link, document database bootstrap | Specced | 14, 26, 37 |

Features 34–37 now live in `archive/mission-4/`; feature 38 remains beside this index while active.

## Sequencing caveats

- **34 first.** It owns the practice hub, the free-session route family, the `SessionProvider` free
  branch, and the `sessions.kind` change. Features 35 and 36 consume the hub.
- **35 second.** It owns the exam tables, the shared exam module, the exam API and screens. It
  depends on 34 only for the hub entry and route conventions.
- **36 after 35.** It consumes the persisted completion and adds the status display; it has no
  schema of its own.
- **37 last.** Its exam trophies need 35's completion state, and its summary strips touch 34's free
  summary. The catalogue is designed in full now so it lands in one pass.
- **Migrations are ordered.** 34 adds `"free"` to the `sessions.kind` check (a SQLite table
  rebuild); 35 adds the exam tables. Each feature PR applies its migration before the client starts
  using it.
- **38 last.** A UI/docs consolidation with no schema or Worker API change: Profile naming, the
  badge shelf move, the top-right profile link, the export/diagnostics removal and the worker.md
  database-bootstrap section. Features 34–37 have landed and are archived.

## Out of scope

Removing Buddy or changing its avatars, dormancy, Care Tokens or care API; an achievements table,
earned dates, a second currency or a second level system; daily check-in; timed challenges;
notification-free reminders; words import; pack validation; exam hints, partial credit or timers;
exams for a topic other than the current one; teacher or parent views of topic status or badges;
offline practice; content changes; any new deployment target.
