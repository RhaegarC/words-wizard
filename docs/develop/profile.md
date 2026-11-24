# Learner data in D1

The Worker keeps every learner-owned row in Cloudflare D1. This page is the schema reference: the
tables, their keys and constraints, and the rules the Worker enforces around them. The product model
is [PRD §8.3](../PRD.md#83-data-model); the operator procedure for deleting an account is in
[operations.md](../operations.md#admin-only-deletion), and the content tables are not covered here.

The schema is defined in `src/worker/db/schema.ts` and applied by the forward-only migrations in
`src/worker/drizzle/`. `wrangler d1 migrations apply` is the only way to create it — never
`EnsureCreated` or a hand-built schema. See
[worker.md](worker.md#initialise-the-database-from-scratch) for local and production bootstrap.

## Rules that hold for every table

- **Identity is `users.oid`.** It is the Entra object id taken from the verified access token. No
  route reads a user id, profile id, or `oid` from a request body or path, and no route returns
  another user's row.
- **Every learner-owned row cascades from `users`.** Each foreign key to `users(oid)` declares
  `ON DELETE cascade`, so deleting the one `users` row removes the profile and all activity. There
  is no delete endpoint; deletion is operator-only.
- **Content is referenced, never cascaded.** User rows point at `topics`, `packs`, and `words` with
  `ON DELETE no action`. Content is archived with `archived_at`, so a row named by a queued session
  commit stays valid.
- **Timestamps are Unix epoch milliseconds** (`Date.now()`). Calendar facts are local-date strings
  in `YYYY-MM-DD`, computed with `src/shared/time.ts` — a local day, never a UTC one.
- **Booleans are `INTEGER` 0/1.**
- **Idempotency is a primary key plus a guarded update.** A replay inserts no second marker and
  changes no counter.

```
users (oid)
 ├─1 profiles (user_id)                              → topics (current_topic_id)
 ├─* progress (user_id, word_id)                     → words
 ├─* pack_introductions (user_id, pack_id, word_id)  → packs, words
 ├─* sessions (user_id, id)
 │    └─* session_metrics (user_id, session_id, name)
 ├─* metrics (user_id, name)
 ├─* metric_events (user_id, event_id)
 ├─* topic_exam_progress (user_id, topic_id)         → topics
 └─* exam_attempts (user_id, attempt_id)             → topics, words
```

Ten tables, all keyed by `oid` either directly or through `profiles`/`sessions`. Badges add no
table: they are derived from `metrics`, `progress`, `sessions`, and the exam rows.

## `users`

The identity root. One row per Entra account, created by the first authenticated request.

| Column | Type | Notes |
|---|---|---|
| `oid` | `TEXT` | Primary key; the Entra object id |
| `created_at` | `INTEGER` | First authenticated request |
| `last_seen_at` | `INTEGER` | Updated by every authenticated request |
| `email` | `TEXT NULL` | Token `email`, else `preferred_username` |

`ensureUser` runs on every authenticated route. It upserts the row and syncs the email with
`COALESCE(excluded.email, users.email)`, so a token without an address never erases a stored one.

## `profiles`

One row per user; creation is idempotent (`INSERT OR IGNORE` on the primary key).

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | Primary key; FK `users.oid`, cascade |
| `character_name` | `TEXT` | Display name; 1–16 code points, trimmed, no control characters |
| `avatar` | `TEXT` | Buddy avatar id; validated against `avatars`, not a D1 foreign key |
| `current_topic_id` | `TEXT NULL` | FK `topics.id`; null until the topic picker completes |
| `xp` | `INTEGER` | Cumulative XP; stage is derived, never stored |
| `created_at` | `INTEGER` | Profile creation |
| `last_practice_at` | `INTEGER` | Seeded with `created_at`; moved by a session commit |
| `last_wake_at` | `INTEGER NULL` | Last quick wake |
| `frozen_days` | `INTEGER` | Days bought with Care Tokens |
| `care_tokens` | `INTEGER` | Held tokens, 0–3 |
| `sessions_since_last_token` | `INTEGER` | 0–5; one token per five completed sessions |
| `completed_sessions` | `INTEGER` | Lifetime count |
| `streak_count` | `INTEGER` | Current local-day streak |
| `best_streak` | `INTEGER` | Highest streak reached |
| `last_streak_date` | `TEXT NULL` | Local date key, e.g. `2026-10-21` |
| `last_monthly_review_at` | `INTEGER NULL` | Last monthly review |
| `locale` | `TEXT` | `en` or `zh`; CHECK |
| `role` | `TEXT` | `user`, `teacher`, or `admin`; CHECK, default `user` |
| `user_avatar_key` | `TEXT NULL` | R2 key of the uploaded photo |

- **`role` is identity, not profile data.** The Worker copies it from the verified token on every
  request and authorization reads the token, never this column, so a stale or tampered row cannot
  grant access. Only a token from the home tenant can carry `teacher` or `admin`; every other tenant
  maps to `user`.
- **`avatar` is the buddy**, `user_avatar_key` is the child's own photo. The key is shaped
  `avatars/<oid>/<uuid>.<png|jpg|webp>` and points at R2, not at a URL. The object is outside D1 and
  is therefore **not** removed by the database cascade; the deletion procedure removes it separately.
- `masteryXpAwarded` lives on `progress`, not here. `vitality` and `characterStage` are derived on
  every render.

## `progress`

One row per `(user, word)`. The unique key is the upsert target for a session commit and the legacy
import.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `word_id` | `TEXT` | FK `words.id`, no action |
| `status` | `TEXT` | `new`, `learning`, or `mastered`; CHECK |
| `strength` | `REAL` | 0–1; CHECK |
| `next_review_at` | `INTEGER` | Scheduler's next review |
| `correct_count` | `INTEGER` | Lifetime |
| `wrong_count` | `INTEGER` | Lifetime |
| `first_seen_at` | `INTEGER` | First introduction |
| `last_seen_at` | `INTEGER` | Last answer |
| `mastery_xp_awarded` | `INTEGER` | 0/1; prevents a second +10 mastery award |

Primary key `(user_id, word_id)`. A word introduced in two packs still has one progress row; the
legacy import merges with "most advanced wins" and ORs `mastery_xp_awarded` in both directions.

## `pack_introductions`

One row per word introduced in a pack; this is what unlocks a pack, and a word can be introduced in
several packs.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `pack_id` | `TEXT` | FK `packs.id`, no action |
| `word_id` | `TEXT` | FK `words.id`, no action |
| `introduced_at` | `INTEGER` | First introduction |

Primary key `(user_id, pack_id, word_id)`. Commits use `INSERT OR IGNORE`, so a replay never moves
`introduced_at`.

## `sessions`

One row per finished session. The id is generated by the client and unique **per user**, not
globally.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` | Client-generated session id |
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `kind` | `TEXT` | `daily`, `monthly`, or `free`; CHECK |
| `local_date` | `TEXT` | The child's local day, `YYYY-MM-DD` |
| `content_version` | `TEXT` | Content the session was played against |
| `xp_earned` | `INTEGER` | XP credited for this session |
| `finished_at` | `INTEGER` | Client completion time |
| `created_at` | `INTEGER` | Server commit time |

Primary key `(user_id, id)`. The commit uses `INSERT OR IGNORE`, so the first commit of a session id
wins and a retry cannot create a second row.

## `session_metrics`

The per-session marker that makes a session commit idempotent, and the only record of a session's
counter deltas.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | Part of the composite FK |
| `session_id` | `TEXT` | Part of the composite FK |
| `name` | `TEXT` | Metric name |
| `delta` | `REAL` | Amount added on the first commit |

Primary key `(user_id, session_id, name)`; composite FK to `sessions(user_id, id)` with
`ON DELETE cascade`. The counter update is gated on this insert (`changes() = 1`), so replaying a
commit adds no XP or count a second time.

## `metrics`

Aggregated per-user counters; badges read these and there is no badge table.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `name` | `TEXT` | Allowlisted name from `src/shared/metrics.ts` |
| `value` | `REAL` | Current value; may be negative for `monthlyReview.strengthDelta` |
| `updated_at` | `INTEGER` | Last change |

Primary key `(user_id, name)`. Rows are seeded for every allowlisted name when the profile is
created, and `INSERT OR IGNORE` seeds any name added later. The name is not constrained in SQL: the
API rejects an unknown name, and the legacy import skips and counts one.

## `metric_events`

One row per processed client event, used as the idempotency marker for metric and care writes.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `event_id` | `TEXT` | Client-generated id, at most 64 characters |
| `name` | `TEXT` | Metric name, or a care marker |
| `delta` | `REAL` | Amount applied once |
| `created_at` | `INTEGER` | First processing |

Primary key `(user_id, event_id)`. A care action stores `care.freeze` or `care.quickWake` here; a
freeze leaves no other trace, while a quick wake also increments `revival.quickWake`. An event id is
idempotent for its user; another user may reuse the same string.

## `topic_exam_progress`

One resumable exam state per `(user, topic)`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `topic_id` | `TEXT` | FK `topics.id`, no action |
| `passed_parts` | `INTEGER` | CHECK `0 <= passed_parts <= part_count` |
| `part_count` | `INTEGER` | CHECK `> 0` |
| `content_version` | `TEXT` | Version the state was built against |
| `attempts` | `INTEGER` | Submitted parts, passed or failed |
| `last_attempt_at` | `INTEGER NULL` | Last submission |
| `completed_at` | `INTEGER NULL` | First full pass; sticky |
| `updated_at` | `INTEGER` | Last write |

Primary key `(user_id, topic_id)`. `completed_at` survives a retake and a content change. An
unfinished state whose `content_version` no longer matches is reset to zero parts before the next
submission.

## `exam_attempts`

Idempotency and a minimal audit trail. It never stores a typed spelling.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `TEXT` | FK `users.oid`, cascade |
| `attempt_id` | `TEXT` | Client-generated idempotency key |
| `topic_id` | `TEXT` | FK `topics.id`, no action |
| `part_index` | `INTEGER` | CHECK `>= 0` |
| `passed` | `INTEGER` | 0/1; CHECK |
| `missed_word_id` | `TEXT NULL` | FK `words.id`, no action; null when the part passed |
| `at` | `INTEGER` | Server submission time |

Primary key `(user_id, attempt_id)`, plus index `exam_attempts_topic (user_id, topic_id)`. A replay
returns the recorded outcome. The same attempt id submitted for another topic or part is a 409.

## Rules the Worker enforces instead of D1

SQLite can enforce the types, ranges, and foreign keys above, but not cross-table allowlists or
request identity. Those live in the Worker:

- `profiles.avatar` must name a row in `avatars` (`avatarExists`); there is no D1 foreign key because
  the buddy list is seed content, not user data.
- `profiles.current_topic_id` is a real foreign key, so the Worker checks existence first to answer
  `400` rather than surfacing a constraint error.
- `metric_events.event_id` and `metrics.name` are allowlisted in code, not by a CHECK.
- The profile name, locale, avatar image type, and 2 MiB upload bound are validated at the boundary.
  A request body can never set `role`, `oid`, XP, or counters directly.

## Deletion and retention

The cascade is the whole user-data deletion: one `DELETE FROM users WHERE oid = '<oid>'` removes the
profile, progress, introductions, sessions, session metrics, counters, event markers, and exam rows.
The uploaded photo is an R2 object and needs its own delete. Do not run the statement from a laptop
against production without the approval and record-keeping in
[operations.md](../operations.md#admin-only-deletion).

Migrations are forward-only. Change `src/worker/db/schema.ts`, generate a migration into
`src/worker/drizzle/`, commit both, then apply it; a bad migration is fixed by a new one, never by
editing an applied file.
