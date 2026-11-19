# Feature 35 — Exam Mode

> Priority: Must · Mission 4 · **Status: Specced**
> Depends on: 34 (the practice hub and route conventions), 22 (content), 23–24 (API and client).
> Blocks: 36 (topic completion), 37 (topic trophies).
> Source of truth: [Mission 4 sprint](00-mission-4-sprint.md).

## Summary

Add a topic exam the child can take once every word in the topic has been introduced. The exam is
spelling-only and split into parts of fewer than 50 words. Each word gets one clean typed attempt;
one wrong spelling fails the part, which restarts from its first word. Passed parts stay passed, so
a long exam is resumable across sittings.

The exam is an assessment, not a practice session: it writes no progress, awards no XP, and does
not move the streak or Care Token cadence. Its only outcomes are the part state, the exam metrics,
and (on the final pass) the topic's Completed status.

## User story

As a **child**, I want to prove I can spell the words in a topic, in manageable parts, so that
finishing it feels like a real achievement. As a **parent or teacher**, I want the exam to be a
stricter test than practice and to leave the learning schedule alone.

## Design

### Availability gate

- The exam is available only when **every distinct word in the topic has at least one introduction
  row** for this user. This is the literal meaning of "all packs unlocked": the final pack's words
  are included, not just the previous packs' words.
- The client hides or disables the hub card, showing `introduced / total`; the Worker re-checks the
  gate on every exam request and refuses a locked exam with `409 exam_locked`.
- The exam always targets the **current topic**. Another topic's exam is reachable after the child
  switches topic; exam state is per topic and persists across switches.

### Part construction

- Collect the topic's **distinct** word ids.
- Order them deterministically: pack `order` ascending (tie: pack id), then `pack_words.position`
  ascending, then word id. Deduplicate at first occurrence.
- `partCount = ceil(wordCount / 49)`, so **every part is strictly fewer than 50 words**.
- Split as evenly as possible: the first `wordCount % partCount` parts get one extra word.
  Examples: 60 → 30 + 30; 100 → 34 + 33 + 33; 49 → one part; 50 → 25 + 25.
- The same pure function runs on the client (for display) and in the Worker (for authority). The
  server returns the part boundaries on the exam read, so the client never invents them.

### Persistence

Two new tables in migration **0004** (0003 is feature 34's `free` session kind):

**`topic_exam_progress`** — one row per `(user_id, topic_id)`:

| Column | Meaning |
|---|---|
| `passed_parts` | Number of leading parts passed; `0..part_count`. |
| `part_count` | Part count for the content version the exam was built against. |
| `content_version` | The content version the recorded state covers. |
| `attempts` | Number of part submissions, for diagnostics. |
| `last_attempt_at` | Timestamp of the latest submission, nullable. |
| `completed_at` | First time every part passed, nullable and **sticky**. |
| `updated_at` | Last write. |

Constraints: `passed_parts <= part_count`; `ON DELETE CASCADE` to `users(oid)`; `topic_id`
references `topics.id`. Completion is deliberately independent of the current part counters: a
later retake under a changed content version may reset `passed_parts` while `completed_at` stays
set, so no check couples the two.

**`exam_attempts`** — idempotency and a minimal audit trail:

| Column | Meaning |
|---|---|
| `attempt_id` | Client-generated id, unique per user. |
| `topic_id`, `part_index`, `passed` | What was attempted and its result. |
| `missed_word_id` | The word that ended a failed part, nullable. |
| `at` | Timestamp. |

The primary key is `(user_id, attempt_id)`. **No typed spelling answers are stored** — only the
pass/fail outcome and the missed word id.

Completion is sticky: `completed_at` is set once and never cleared by a retake or a content
change. A completed topic's trophy therefore cannot un-earn.

### API

All routes sit under the existing `/v1/me/*` authentication and `Cache-Control: no-store`.

- **`GET /v1/me/exams`** — every topic exam state for the user, for the hub and the topic picker.
- **`GET /v1/me/exams/:topicId`** — one state plus the gate (`introduced`, `total`, `unlocked`) and
  the server-built part boundaries (`index`, `wordIds`).
- **`POST /v1/me/exams`** — submit one part:

```json
{
  "topicId": "craft",
  "partIndex": 0,
  "attemptId": "uuid",
  "contentVersion": "2026-11-19.1",
  "answers": [{ "wordId": "w-hammer", "answer": "hammer" }]
}
```

The server compares each answer to the expected spelling after a single shared normalization
(trim, case-fold, collapse internal whitespace), then returns:

```json
{
  "passed": false,
  "missedWordId": "w-chisel",
  "correctSpelling": "chisel",
  "state": { "passedParts": 0, "partCount": 2, "completed": false },
  "metrics": []
}
```

- Missing, extra, duplicate or unknown word ids are `422 validation_failed`; an out-of-order part
  is `409 exam_locked`; a stale content version is `409 exam_stale`.
- **Idempotency:** the `exam_attempts` primary key is the marker. A replay with the same
  `attemptId` returns the stored outcome and does not apply metrics or increment `attempts`. Reusing
  an id for a different topic or part is `409 conflict`.
- A pass advances `passed_parts` monotonically (`max(passed_parts, partIndex + 1)`); passing the
  last part sets `completed_at = COALESCE(completed_at, now)`. A fail leaves `passed_parts`
  unchanged.
- The marker, progress row and metric deltas are written in one D1 batch, after validation.

### Content changes

- The state records the `content_version` and `part_count` it covers.
- **Completed:** stays Completed if the content later adds words. A retake runs under the current
  content, resets the retake's part counters to the new version, and does not clear completion.
  New words do not reopen the exam automatically.
- **Unfinished:** if the live content version differs, the submit returns `409 exam_stale` and the
  server resets `passed_parts` to 0 with the new `part_count` and version. The child sees "The word
  list changed; start the exam again." This avoids mixing parts from two word sets.
- A locked (not all words introduced) topic is `409 exam_locked` until the gate is met.

### Exam screens and input

- **Exam landing** (`#/session/exam`) — the current topic's status, part count, words per part,
  `introduced / total` gate progress, and Start / Resume / Retake.
- **Exam part** (`#/session/exam/part/:index`) — one word at a time. The prompt shows the word's
  meaning and definition in both languages, phonetic, and optional audio. The child **types the
  spelling** into a plain field and submits once. There are **no letter tiles, no hint button, and
  no reveal**.
- A wrong submission ends the part immediately. The fail screen shows the missed word and its
  correct spelling, encouraging copy, and **Retake part**; the part restarts at word 0. Earlier
  parts stay passed.
- A clean part shows a short pass screen and the next part (or the topic-complete summary).
- The exam summary shows parts passed, words attempted, topic status, and any newly earned badges;
  it shows no XP or stage change.
- A reload resumes at the next unpassed part from the server state. Switching topic preserves the
  state; returning to the topic resumes it.
- Exam routes are added to every exhaustive route record and to `App.tsx`; the exam screens own
  their state rather than reusing `SessionProvider`, because the reducer and accounting differ.

### Accounting and metrics

- **No** progress rows, strength, next-review, XP, streak, `completedSessions`, Care Token cadence or
  `lastPracticeAt` change. The normal session commit is not used.
- Add three cumulative metrics to `METRIC_NAMES`: `exam.partPassed`, `exam.partFailed` and
  `exam.topicCompleted` (one per first completion). They are non-negative, so the existing metric
  validation is unchanged apart from the allowlist.
- The exam is not in the session history table; `exam_attempts` is its own minimal record.

## Acceptance criteria

- [ ] The exam is unavailable until every distinct topic word has an introduction; the hub shows
      gate progress and the Worker enforces it.
- [ ] Parts hold fewer than 50 words, are balanced, and follow the deterministic pack/position
      order.
- [ ] Parts are taken in order; a passed part persists across a reload and across a topic switch.
- [ ] One typed attempt per word; no tiles, hints or reveal; a wrong spelling fails the part
      immediately.
- [ ] The fail screen shows the missed word and correct spelling; Retake restarts that part and
      keeps earlier passes.
- [ ] Passing the last part marks the topic Completed; a retake keeps it Completed.
- [ ] The exam changes no progress, strength, review date, XP, streak, completed sessions or Care
      Token state.
- [ ] Exam state and attempts are stored server-side; no typed spelling answer is stored.
- [ ] A replayed submission is idempotent; a stale unfinished exam returns `409 exam_stale` and
      resets cleanly; a completed exam survives content growth.
- [ ] `exam.partPassed`, `exam.partFailed` and `exam.topicCompleted` are recorded.
- [ ] The exam screens read content at render and both locales cover every new string.

## Test plan

- **Unit** — part construction: distinct ids, deterministic order, balanced sizes, the `<50` rule
  at 49/50/60/100, and identical client/server output; spelling normalization; pass/fail state
  transitions; reducer.
- **Model** — the new tables, constraints and cascade; the exam tables' generated SQL.
- **Database** — migration 0004 applies to a real D1 engine; `passed_parts`/`completed_at`
  constraints hold; the cascade removes exam rows; `foreign_key_check` is clean.
- **Host** — the full gate/submit/retake/resume cycle through the real Worker: locked exam, wrong
  answer, failed part, passed part, resumability, final completion, idempotent replay, stale
  content, and no progress/XP/streak side effects.
- **Page** — the landing gate states, typed input, one-submission behaviour, fail feedback, part
  progression, summary, and route round-trips.
- **Manual** — take a multi-part exam, reload between parts, fail and retake one part, then
  complete the topic and confirm daily practice is unchanged.

## Documentation impact

PRD §5.2, §7.8 (new), §8.3, §8.5, §9, §13, §14, §15 and Appendix A; privacy (exam state and
attempts); `docs/develop/worker.md` (routes, tables, validation); `docs/operations.md` (the
deletion cascade and the migration list); README; features 36 and 37.

## Risks

- **Gate wording.** "All packs unlocked" is not literally "every word introduced" for the final
  pack; this feature uses the stricter every-word rule and states it in the UI.
- **Content drift.** Part boundaries depend on content; the stale/reset rule must be visible and
  tested against a real migration and a changed bundle.
- **Fairness.** One clean typed attempt on up to 49 words is demanding; the fail screen's teaching
  value and the resumable parts are the mitigation.
- **No raw answers.** The server compares and discards the submitted strings; only the missed word
  id is stored. This must stay true in the schema and the logs.
- **Route and state ownership.** The exam does not use `SessionProvider`; its own reducer and
  screens must not duplicate the practice commit path.

## Out of scope

Hints, partial credit, timers, score history, item randomization, exams for a topic other than the
current one, XP/streak rewards, exam-specific content, teacher-visible exam results, and storing raw
spelling answers.
