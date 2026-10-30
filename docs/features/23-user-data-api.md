# Feature 23 — User Profile, Progress & Session Commit

> Priority: Must · Mission 2 · **Status: In review — PR [#60](https://github.com/RhaegarC/words-wizard/pull/60)**
> Depends on: 21 (auth edge), 22 (content tables and word ids). Blocks: 24.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Give an Entra identity somewhere to live. This feature adds the user tables, the `/v1/me` read,
profile creation and patching, the session commit, and the small metric and Care Token writes. It
also adds `pack_introductions`, the per-pack record that proves a word was introduced to a user in a
particular pack. The client still computes the post-session state and the sequential pack unlock;
the Worker validates both and stores them in one atomic, idempotent D1 batch. The token's `oid` is
the only user key the server will ever use.

There is no user-facing delete or reset. Deletion is an operator procedure documented in feature 25.

## User story

As a **child**, I sign in and find my buddy, XP, streak, and words waiting, on any device. If the
network drops when a session ends, the session is not lost and is not counted twice. As a
**parent**, no one else can see or change my child's progress, and the app stores only what the
learning loop needs.

## D1 schema (user)

Generated in its own user migration, after the content migrations.

| Table | Columns |
|---|---|
| `users` | `oid TEXT PK`, `created_at`, `last_seen_at` |
| `profiles` | `user_id TEXT PK FK users.oid`, `character_name`, `avatar`, `current_topic_id FK topics.id NULL`, `xp`, `created_at`, `last_practice_at`, `last_wake_at NULL`, `frozen_days`, `care_tokens`, `sessions_since_last_token`, `completed_sessions`, `streak_count`, `best_streak`, `last_streak_date NULL`, `last_monthly_review_at NULL`, `locale CHECK ('en','zh')` |
| `progress` | `user_id FK users.oid`, `word_id FK words.id`, `status CHECK ('new','learning','mastered')`, `strength CHECK 0..1`, `next_review_at`, `correct_count`, `wrong_count`, `first_seen_at`, `last_seen_at`, `mastery_xp_awarded`, `PK(user_id, word_id)` |
| `pack_introductions` | `user_id FK users.oid`, `pack_id FK packs.id`, `word_id FK words.id`, `introduced_at`, `PK(user_id, pack_id, word_id)` |
| `metrics` | `user_id FK users.oid`, `name`, `value REAL`, `updated_at`, `PK(user_id, name)` |
| `sessions` | `id`, `user_id FK users.oid`, `kind CHECK ('daily','monthly')`, `local_date`, `content_version`, `xp_earned`, `finished_at`, `created_at`, `PK(user_id, id)` |
| `session_metrics` | `user_id`, `session_id`, `name`, `delta`, `PK(user_id, session_id, name)`, `FK(user_id, session_id) -> sessions(user_id, id)` |
| `metric_events` | `user_id`, `event_id`, `name`, `delta`, `created_at`, `PK(user_id, event_id)` |

Notes:

- No email, display name from Entra, photo, or tenant list is stored. `users` holds the opaque `oid`
  and two timestamps.
- `profiles` has no separate `name` column; the API returns `name: characterName` because Mission 1
  keeps them identical.
- Every authenticated request upserts `users(oid, created_at, last_seen_at)` before touching
  profile data.
- Profile creation seeds one `metrics` row per `METRIC_NAMES` value at `0`; the commit and metric
  writes still ensure a row defensively, so a name added by a later migration is not lost.
- Every user-owned foreign key (`profiles`, `progress`, `pack_introductions`, `metrics`, `sessions`,
  `session_metrics`, `metric_events`) is declared `ON DELETE CASCADE`, and `session_metrics`
  cascades from `sessions`. That makes the operator-only deletion in feature 25 a single
  `DELETE FROM users WHERE oid = ?`; no endpoint exposes it.
- `pack_introductions` references content rows but never cascades from them. Content is archived,
  not deleted, so an introduction stays valid; the row is removed only with its user.
- Word-level mastery lives in `progress` and is shared across packs. The introduction is per pack,
  so the same word introduced in a second topic creates a second `pack_introductions` row while
  `progress` keeps one row for the word.

## API contract added

All routes require `Authorization: Bearer <token>`; the user is the token's `oid`. No route accepts
a user id, profile id, or `oid` in its body or path.

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/v1/me` | — | `{ profile: Profile \| null, progress: Progress[], metrics: Metric[], introductions: PackIntroduction[] }` |
| POST | `/v1/me/profile` | `{ characterName, avatar, currentTopicId?, locale, now }` | `201` with the new profile; `200` with the existing one if already created |
| PATCH | `/v1/me/profile` | any of `{ characterName, avatar, currentTopicId, locale }` | `200` with the updated profile |
| POST | `/v1/me/sessions` | session commit payload (below) | `200` with `{ profile, progress, metrics, introductions }` |
| POST | `/v1/me/metrics` | `{ name, delta, eventId }` | `200` with the updated metric |
| POST | `/v1/me/care` | `{ action: "freeze" \| "quickWake", eventId }` | `200` with `{ profile }` |

`GET /v1/me` returns `profile: null` for an identity that has signed in but not created a
character. It is not a `404`. `introductions` is `[]` until the first committed session and never
null; the client uses it, with the bundle's pack order, to decide which pack is unlocked.

The wire shapes live in [`src/shared/me.ts`](../../src/shared/me.ts) and carry no numeric row ids
and no `profileId`: the profile is keyed by the token's `oid`, `ServerProfile` returns `name` (which
Mission 1 keeps identical to `characterName`) plus the fields above, `ServerProgress` is keyed by
`wordId`, and `ServerMetric` is `{ name, value, updatedAt }`. Feature 24 removes the client's
numeric compatibility seam against exactly these shapes.

Every response carries `Cache-Control: no-store`. All routes answer `401` before touching D1 when
no token is sent.

### Profile creation

- `characterName` follows feature 06's rule: trim, 1–16 Unicode code points, no C0/C1 controls or
  Unicode line/paragraph separators.
- `avatar` must be an avatar id in D1; `currentTopicId` must be `null` or a topic id in D1; `locale`
  is `en` or `zh`.
- Defaults match Mission 1: `xp 0`, `createdAt`/`lastPracticeAt` = `now`, `lastWakeAt null`,
  `frozenDays 0`, `careTokens 0`, `sessionsSinceLastToken 0`, `completedSessions 0`,
  `streakCount 0`, `bestStreak 0`, `lastStreakDate null`, `lastMonthlyReviewAt null`.
- Creation is idempotent: if the identity already has a profile, the body is not applied and the
  existing profile is returned. A concurrent double-tap cannot create two rows.

### Profile patch

- Accepts only `characterName`, `avatar`, `currentTopicId`, and `locale`; `characterName` also
  becomes `name` on read.
- Server-owned fields — `xp`, streak, tokens, counters, `createdAt`, `lastPracticeAt` — are rejected
  as unknown fields, not silently ignored.
- `PATCH` without an existing profile is `404 profile_not_found`.
- A rejected field changes nothing.

### Session commit payload

```ts
{
  session: { id, kind: "daily" | "monthly", localDate, contentVersion, xpEarned, finishedAt },
  now: number,
  profile: {
    xp, lastPracticeAt, lastWakeAt?, frozenDays, careTokens, sessionsSinceLastToken,
    completedSessions, streakCount, bestStreak, lastStreakDate, lastMonthlyReviewAt?
  },
  progress: Array<{
    wordId, status, strength, nextReviewAt, correctCount, wrongCount,
    firstSeenAt, lastSeenAt, masteryXpAwarded
  }>,
  introductions: Array<{ packId, wordId, introducedAt }>,
  metrics?: Record<MetricName, number>
}
```

Identity is not in the payload. The server takes `oid` from the verified token.

Validation, before any write:

- [x] `session.id` is a non-empty string up to 64 characters; `kind` is `daily` or `monthly`;
      `localDate` is a real `YYYY-MM-DD`; `contentVersion` is a non-empty string; `xpEarned` is an
      integer in `0..10 000`.
- [x] `now` and `finishedAt` are finite and within **±24 hours** of server time. A timestamp outside
      that window is `422 clock_out_of_range`; the server never silently substitutes its own time.
- [x] `profile` is an allowlist of the fields above; every number is non-negative and finite, every
      timestamp is within the same ±24-hour window (or `null` where the type allows it), and
      `lastStreakDate` is a real date or `null`.
- [x] `progress` has at most 40 rows, no duplicate `wordId`, `status` in the enum, `strength` in
      `0..1`, counts non-negative integers, `masteryXpAwarded` a boolean, and every `wordId` exists
      in `words`. An unknown word id is `422 unknown_word`.
- [x] `introductions` has at most 40 rows, no duplicate `(packId, wordId)` pair, every
      `introducedAt` is within the same ±24-hour window, and every pair exists in `pack_words`. An
      unknown pair is `422 unknown_pack_word`; a pair from a pack in another topic is still valid,
      because a word may belong to several packs.
- [x] `metrics` names are in `METRIC_NAMES`; deltas are finite. Only `monthlyReview.strengthDelta`
      may be negative (in `-1..1`); every other delta is non-negative. Unknown names are rejected.
- [x] A JSON body over 64 KB is refused before parsing, as `422 validation_failed`.
- [x] A rejected payload writes nothing: validation completes before the batch is built.

### Atomic, idempotent commit

One `db.batch()`, in this order:

1. `INSERT OR IGNORE INTO users (...)`, stamping `last_seen_at`.
2. `INSERT OR IGNORE INTO sessions (...)`. The `(user_id, id)` key makes a replay a no-op at this
   step.
3. Absolute `UPDATE profiles SET ... WHERE user_id = ?`.
4. Absolute upserts of every `progress` row:
   `INSERT ... ON CONFLICT(user_id, word_id) DO UPDATE SET ...`.
5. `INSERT OR IGNORE INTO pack_introductions (user_id, pack_id, word_id, introduced_at) VALUES
   (?, ?, ?, ?)` for every introduction row. The `(user_id, pack_id, word_id)` key makes a replay a
   no-op; a later session in the same pack adds only pairs that are genuinely new.
6. For each metric: `INSERT OR IGNORE INTO metrics (user_id, name, value, updated_at) VALUES (?, ?,
   0, ?)`; then `INSERT OR IGNORE INTO session_metrics (user_id, session_id, name, delta)`; then
   `UPDATE metrics SET value = value + delta, updated_at = ? WHERE user_id = ? AND name = ? AND
   changes() = 1`.

Steps 3–4 are absolute post-session values, so replaying the identical outbox payload is harmless.
Step 5 is the same shape at the pack level: the introduction set is monotonic, and a replay cannot
create a second row or move an existing `introduced_at`. Step 6 is the counter guard: the marker
insert returns `changes() = 1` only on the first commit, so a replay cannot add XP or session counts
twice. The defensive `INSERT OR IGNORE INTO metrics` gives a metric name added after this profile
was created a row to update, instead of silently dropping its first delta.

The response is read back after the batch and returned as the authoritative post-commit state. A
replay returns the same state and changes no counter.

**Known limitation, stated rather than hidden:** the same session id sent with a *different* payload
would re-apply the absolute profile/progress values (the metrics stay guarded). The outbox always
replays the identical payload, and the client is the source of its own post-session state, so this
is accepted for v1. It does not cross the authorization boundary: a token can only do this to its own
`oid`.

### Metric and care writes

- `POST /v1/me/metrics` validates the name/delta like the commit, requires an `eventId` of 1–64
  characters, inserts `metric_events` as the idempotency marker, and adds the delta only when the
  marker is new. A replay returns the current value.
- `POST /v1/me/care` takes `{ action, eventId }` with the same 1–64 character `eventId` bound,
  applies the shared pure rules (`spendOnFreeze`, `spendOnQuickWake`) on the
  server: one token, the same profile change the client would have made, and its metric row in the
  same batch. An unaffordable action is `409 care_unavailable` **before** any write. The
  `metric_events` insert is the marker, and the profile update follows it gated on
  `changes() = 1`, so a replay by `eventId` does not spend a second token. The marker records
  `care.freeze` or `care.quickWake` as its `name`; these are event kinds, not metric counters, and a
  freeze has no `metrics` row of its own.
- Non-session metric and care writes never change progress or the session history.

### Errors

| Status | Code | When |
|---|---|---|
| 400 | `invalid_json` | Body is not JSON |
| 401 | `unauthorized` | Missing, invalid, or expired token |
| 404 | `profile_not_found` | `PATCH`, session commit, or care before a profile exists |
| 409 | `care_unavailable` | No token to spend, or the action is not legal now |
| 422 | `validation_failed` | Any field or range rule above |
| 422 | `clock_out_of_range` | `now` / `finishedAt` outside ±24 h |
| 422 | `unknown_word` | A progress row names a word that is not in D1 |
| 422 | `unknown_pack_word` | An introduction names a `(packId, wordId)` pair that is not in `pack_words` |
| 500 | `internal` | Unexpected failure; no partial write |

## Tasks (ordered)

1. Write the user schema, including `pack_introductions`, and generate the user migration; verify
   keys, checks, and composite foreign keys on local D1.
2. Extend `src/shared/sessionPayload.ts` for the server shape: make the client-side `profileId`
   optional (the server never supplies one), add clock, word-id, metric, introduction-pair, and
   array-size checks, and keep the existing word/strength/XP rules. The page's Dexie provider keeps
   passing `profileId` until feature 24.
3. Implement `src/worker/db/queries.ts`: ensure-user, read-me, create-profile (idempotent), patch,
   commit batch, metric event, care event.
4. Wire the six routes with auth middleware and the error envelope.
5. Add body-size and JSON guards.
6. Write the RED tests per tier before each route (see below).
7. Add the remote gated variant to `pnpm test:db:remote`.
8. Document the admin deletion procedure only when feature 25 writes `docs/operations.md`; do not add
   an endpoint.

## Tests

| Tier | What it proves |
|---|---|
| **Unit** (always) | Every validation boundary above, at the value and one step past it: name 16/17 code points, avatar/topic allowlists, locale, `strength` 0/1/−0.1/1.1, negative XP, clock exactly ±24 h, duplicate/unknown word, 40/41 progress rows, 40/41 introduction rows, duplicate `(packId, wordId)`, unknown `(packId, wordId)`, a pair valid in `pack_words` but belonging to another topic, oversized body, unknown metric, negative delta for the one signed metric, care affordability. |
| **Model** (always) | The user migration declares the keys, checks, and foreign keys the docs claim; `profiles.user_id` is unique; `progress` is keyed by `(user_id, word_id)`; `pack_introductions` is keyed by `(user_id, pack_id, word_id)` and cascades only from `users`. |
| **Database / host** (local, always) | Migrations apply; an unknown `word_id` is refused by the foreign key; a second profile insert for one `oid` collides; the commit batch lands all rows; replaying the same payload leaves every counter, XP, session count, and introduction set unchanged and moves no `introduced_at`; a word introduced in two packs has two rows and one `progress` row; a forced constraint failure mid-batch leaves **no** session, profile, progress, introduction, or metric change; `freeze`/`quickWake` spend exactly one token and replay once; two identities' rows never mix; every route is `401` without a token and succeeds with a locally minted one. |
| **Remote** (gated) | The user migration applies and its checks and composite foreign keys fire on Cloudflare's engine; the commit batch's atomicity is proven by the local database tier, which can run the real Worker. Skips visibly without test credentials. |
| **Manual** | Sign in with two tenant accounts on one browser; each sees only its own profile; a completed session reloads with the same XP/streak. |

**RED-first hot spots**

- **Authorization and ownership:** no token, wrong issuer/audience/tenant/scope, and user A's token
  against user B's data, all written before the routes; plus a body containing `oid` or `profileId`
  proving it is ignored or rejected.
- **Credential issuance boundary:** a fresh identity has no profile until `POST /profile`, and
  creation is idempotent.
- **Input validation:** each boundary value has a rejection test **at** the boundary, asserting zero
  writes.
- **Idempotency:** the replay test and the failed-batch test are written before the batch exists.
- **Care spend:** an unaffordable action is rejected before the write.

The local JWKS server still stands in for token validation only; real Entra issuance remains the
manual check recorded in `docs/operations.md`.

## Non-goals

- No client integration; feature 24 wires MSAL, the provider, and the outbox.
- No account deletion, reset, admin API, or export endpoint; export stays client-side.
- No roles or admin authorization.
- No cross-user reads, sharing, or leaderboards.
- No server-side recomputation of XP, streaks, scheduling, or pack unlock; the Worker validates and
  stores the client's post-session values and introduction rows. The one server-applied domain rule
  is the Care Token spend, which calls the same shared pure function as the client so the two cannot
  disagree.
- No admin read of another user's introductions.
