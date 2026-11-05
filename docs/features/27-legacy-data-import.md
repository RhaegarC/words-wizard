# Feature 27 — Legacy Device Data Import

> Priority: Should (upgrade path from Mission 1) · Mission 2 · **Status: Implemented**
> Depends on: 23 (user-data API), 24 (client online integration), 26 (user profile)
> Blocks: nothing; it changes the Mission 1 upgrade path.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md) and [PRD](../PRD.md) §8.

## Summary

Mission 1 stored the child's profile, word progress, and counters in `WordsWizardDB` (IndexedDB).
Feature 24 deleted that database at boot and declared the old progress unmigratable. This feature
reverses that: the device data is read once, merged into the signed-in account's D1 rows, and the
legacy database is deleted only after a successful import. A child who upgrades keeps their words,
XP, streak, and care state.

The import is automatic, not a button-first flow:

- On the first boot of the new version, after sign-in, content load, outbox drain, and the
  `/v1/me` refresh, it runs automatically when a cloud profile exists.
- If no profile exists yet, it is deferred and runs immediately after character creation.
- It never blocks boot: a failure leaves the legacy database untouched and retries on the next
  boot, with a Settings fallback card offering Retry and Discard.
- A one-time notice reports the result (imported counts, or that the old data could not be moved).

## User story

As a **child upgrading from the offline app**, I sign in and my buddy, XP, streak, and word
progress are already there; I do not have to redo the words I learned. As a **returning child on a
new device**, nothing changes: the import only applies to a device that still holds Mission 1
data.

## Current behaviour being replaced

- `src/page/db/localData.ts` holds `discardLegacyLocalData`, a delete-only path guarded by
  `LOCAL_DATA_DISCARDED_KEY`.
- `src/page/App.tsx` `boot()` calls it after the outbox drain and before `checkProfileAtBoot`,
  and shows a notice.
- Mission 2's Definition of Done records "Local Dexie data is deleted once on first load of the
  new version, with a one-time notice."

This feature removed the flag, `discardLegacyLocalData`, and the boot deletion. A device whose
database was already deleted simply yields no import; nothing recreates it.

## Locked decisions

1. **Automatic + fallback card** — import on the first boot after sign-in and profile load; delete
   only after success; keep a Settings card while data remains (failed or deferred) with Retry and
   Discard; one-time notice.
2. **Right after character creation** — a new identity's import runs immediately after
   `createProfile`, not at the boot where no profile exists.
3. **Most advanced wins** — per word: status rank `new < learning < mastered`, then strength, then
   earlier `nextReviewAt`; a full tie keeps the cloud row; `masteryXpAwarded` OR-ed. Profile
   counters and timestamps take the larger/later value; metrics take `max`.
4. **Keep until imported or discarded** — stop deleting at boot; delete after a successful import
   or an explicit discard.
5. **Progress + counters, rebuild unlocks** — no `pack_introductions` rows are derived; pack
   unlocks rebuild naturally from progress.

## Automatic import flow

```
boot()
  fetch content + provider.refresh()        (existing)
  loadContent / configureProgressProvider   (existing)
  outbox.drain(...)                          (existing — newest cloud state before the merge)
  autoImportLegacy(provider)                 (new)
    absent      -> none
    unreadable  -> unreadable        keep DB; card offers Discard
    ready:
      no profile / no data -> empty  keep DB; card offers Discard
      cloud profile absent -> deferred   keep DB; create flow imports
      cloud profile present -> POST /v1/me/import
        success -> delete the legacy DB -> imported (deleted true/false)
        failure -> failed              keep DB; retry next boot + card
  checkProfileAtBoot(provider)               (existing, reads the post-import snapshot)
```

Rules:

- `autoImportLegacy` never throws into `boot()`; every failure is an outcome.
- The import runs after the outbox drain, so the merge compares against the newest cloud state.
- `deferred` and `empty` show no notice.
- `imported` and `failed` show a one-time notice; the Settings card is the persistent fallback.
- After `createProfile`, `CreateScreen` runs the same helper and passes the merged profile to
  `onCreated`. An import failure must not turn a successful profile creation into a save error.

## Merge rules

### Per word

`progress` is keyed by `(user_id, word_id)`.

1. Rank `new = 0 < learning = 1 < mastered = 2`; the higher rank wins.
2. Equal rank: the higher `strength` wins.
3. Equal rank and strength: the earlier `nextReviewAt` wins.
4. A full tie keeps the cloud row.
5. The winning row is written whole — status, strength, `next_review_at`, both counters, and both
   timestamps — so it stays internally consistent.
6. `mastery_xp_awarded` is `incoming OR cloud` in both directions, so a replay never pays the
   mastery bonus twice.

### Profile counters

Take the larger/later value, never a cloud identity field.

| Field | Rule |
|---|---|
| `xp`, `completedSessions`, `streakCount`, `bestStreak`, `careTokens`, `sessionsSinceLastToken`, `frozenDays` | max |
| `lastPracticeAt`, `lastWakeAt`, `lastMonthlyReviewAt` | later; a `NULL` incoming value keeps the cloud value |
| `lastStreakDate` | lexicographically later `YYYY-MM-DD`; a `NULL` incoming value keeps the cloud value |
| `characterName`, `avatar`, `currentTopicId`, `locale`, `createdAt`, `role`, `userAvatarKey` | never imported |

### Metrics

`value = max(cloud, legacy)`. `updated_at` moves only when the incoming value is greater, and then
takes the later of the two. Unknown metric names are skipped and counted. Max is idempotent even
for the signed `monthlyReview.strengthDelta`.

Nothing in the merge is additive, so the same payload can be sent again without changing a row.

## API contract

### `POST /v1/me/import`

- Token-owned: the identity comes from the verified token, never the body.
- Body cap **256 KiB**; every other route keeps its 64 KiB cap. The body reader takes a
  `maxBytes` parameter and the error message names the applicable limit.
- Requires an existing profile.
- Response:

```json
{
  "progress": { "imported": 120, "skipped": 3 },
  "metrics": { "imported": 14, "skipped": 0 },
  "profileUpdated": true,
  "me": { "email": "...", "profile": {}, "progress": [], "metrics": [], "introductions": [] }
}
```

The `me` field is the full `GET /v1/me` shape, so the client replaces its snapshot in one round
trip rather than issuing a second read.

- Errors: `401 unauthorized` before any database access; `404 profile_not_found` before character
  creation; `422 validation_failed` for a malformed or oversized payload, with nothing written.
- `ROUTES` gains `"/v1/me/import": ["POST"]`, so a wrong method is `405`, not `404`.

### Payload

The shape is camelCase, matching `ServerProfile`, `ServerProgress`, and `ServerMetric`.

```ts
interface LegacyImportPayload {
  profile: {
    xp: number
    lastPracticeAt: number
    lastWakeAt: number | null
    frozenDays: number
    careTokens: number
    sessionsSinceLastToken: number
    completedSessions: number
    streakCount: number
    bestStreak: number
    lastStreakDate: string | null
    lastMonthlyReviewAt: number | null
  }
  progress: Array<{
    wordId: string
    status: "new" | "learning" | "mastered"
    strength: number
    nextReviewAt: number
    correctCount: number
    wrongCount: number
    firstSeenAt: number
    lastSeenAt: number
    masteryXpAwarded: boolean
  }>
  metrics: Array<{ name: string; value: number; updatedAt: number }>
}
```

### Validation

- Top level exactly `profile`, `progress`, `metrics`; unknown fields reject.
- `profile` exactly the 11 fields above. `id`, `profileId`, `name`, `characterName`, `avatar`,
  `currentTopicId`, `locale`, `createdAt`, `role`, and `userAvatarKey` reject as unknown fields.
- At most **512** progress rows and **32** metric rows.
- `strength` is a finite number in `0..1`; counters are integers in `0..1_000_000_000`;
  timestamps are integers in `0..4_102_444_800_000` (2100-01-01).
- `status` is one of the three enum values; `masteryXpAwarded` is a boolean.
- `lastStreakDate` is `null` or a valid `YYYY-MM-DD`.
- Metric values are finite and may be signed (the monthly review delta is signed).
- Duplicate `wordId` and duplicate metric `name` reject.
- Unknown word ids and unknown metric names are **not** validation errors. They are skipped at the
  merge and counted in `skipped`, because content may have been replaced or archived since
  Mission 1.
- The session commit's ±1-day clock window must **not** be reused: imported dates are historical,
  and an overdue `nextReviewAt` is valid.

## Server write design

The merge is SQL-level rather than read-then-write, so two tabs cannot overwrite each other.

### Progress

One `INSERT ... ON CONFLICT (user_id, word_id) DO UPDATE` whose `CASE` selects either `excluded`
or the existing row:

```sql
INSERT INTO progress (
  user_id, word_id, status, strength, next_review_at,
  correct_count, wrong_count, first_seen_at, last_seen_at, mastery_xp_awarded
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, word_id) DO UPDATE SET
  status       = CASE WHEN {incomingWins} THEN excluded.status       ELSE progress.status       END,
  strength     = CASE WHEN {incomingWins} THEN excluded.strength     ELSE progress.strength     END,
  next_review_at = CASE WHEN {incomingWins} THEN excluded.next_review_at ELSE progress.next_review_at END,
  correct_count  = CASE WHEN {incomingWins} THEN excluded.correct_count  ELSE progress.correct_count  END,
  wrong_count    = CASE WHEN {incomingWins} THEN excluded.wrong_count    ELSE progress.wrong_count    END,
  first_seen_at  = CASE WHEN {incomingWins} THEN excluded.first_seen_at  ELSE progress.first_seen_at  END,
  last_seen_at   = CASE WHEN {incomingWins} THEN excluded.last_seen_at   ELSE progress.last_seen_at   END,
  mastery_xp_awarded = CASE
    WHEN excluded.mastery_xp_awarded = 1 OR progress.mastery_xp_awarded = 1 THEN 1 ELSE 0 END
```

`{incomingWins}` is the rank/strength/`next_review_at` comparison from the merge rules, with
`rank(x) = CASE x.status WHEN 'mastered' THEN 2 WHEN 'learning' THEN 1 ELSE 0 END`.

### Profile

One `UPDATE`, using `MAX(col, ?)` for counters, a `CASE` on `NULL` plus `MAX(COALESCE(...))` for
later-value columns, and a lexicographic `MAX` for `last_streak_date`. No identity field appears in
the statement.

### Metrics

```sql
INSERT INTO metrics (user_id, name, value, updated_at) VALUES (?, ?, ?, ?)
ON CONFLICT(user_id, name) DO UPDATE SET
  value = MAX(metrics.value, excluded.value),
  updated_at = CASE WHEN excluded.value > metrics.value
    THEN MAX(metrics.updated_at, excluded.updated_at)
    ELSE metrics.updated_at END
```

### Existence and batching

- Known word ids are read with `SELECT id FROM words WHERE id IN (?,...)` in chunks of **90**
  ids. D1 caps bound parameters per query at 100; unknown ids are counted, not failed.
- Known metric names are filtered through the shared `MetricName` set; unknown names are counted.
- Profile and metrics are one atomic `db.batch` (at most 33 statements).
- Progress is chunked at **90 statements per batch**.
- Every statement is an idempotent merge, so a failed run leaves a valid prefix and the retry
  converges.
- **State the seam:** profile and metrics commit atomically; progress does not. Do not claim the
  whole import is one batch, because D1's batch ceiling is smaller than a full history.

## Client storage design

The reader is raw IndexedDB; Dexie is not a dependency.

- Open `WordsWizardDB` with **no version**. In `onupgradeneeded`, abort the version-change
  transaction and resolve `absent` for a missing database. Do not use `indexedDB.databases()`
  (not universal, and unnecessary).
- Require the Mission 1 v1 store set `profiles`, `progress`, `metrics`. Anything else — for
  example the Figma prototype's `profiles`-only database — is `unreadable`.
- Read with `getAll()` from each store, close the connection in `finally`, and set
  `onversionchange` to close, so another tab's discard is not blocked.
- Deletion returns `deleted`, `blocked`, or `unavailable`. A blocked deletion keeps the card and
  says to close other tabs.
- Remove `LOCAL_DATA_DISCARDED_KEY` and `discardLegacyLocalData`; keep `LEGACY_DATABASE_NAME`.
- Build the payload from the most recently practised legacy profile: greatest `lastPracticeAt`,
  then `createdAt`, then numeric `id`. Filter rows by that profile's numeric `profileId`. Drop
  malformed rows and count them. Dedupe progress by `wordId` using the same most-advanced rule and
  metrics by `name` (max value, max `updatedAt`).
- If there is no usable profile or no importable data, keep the database and let the card offer
  Discard.

## UX

### One-time notice

- Imported: report words, counters, and skipped entries. If deletion was blocked, say the old data
  remains and can be removed in Settings.
- Failed: say the old data is still on the device and can be retried in Settings.
- No notice for `none`, `deferred`, `empty`, or `unreadable`.

### Settings fallback card

Rendered immediately after the export card, using the existing `settings-card`, modal markup, and
`<p role="alert" className="form-error">` error pattern.

- Absent database: render nothing.
- Unreadable: "Old data found, but it cannot be read" plus **Discard**.
- Ready with no importable data: "Nothing to import" plus **Discard**.
- Ready with data: found counts, optional dropped-row note, **Import** (with confirmation) and
  **Discard** (with confirmation).
- Import success: summary with imported, skipped, and deletion status.
- Import failure: keep the card with **Retry**.
- Deletion blocked: explain that another tab is using the data and offer a retry.

### Character creation

`CreateScreen` runs the same helper after `createProfile` and passes the merged profile to
`onCreated`, so the Home screen shows the imported counters immediately.

### Internationalisation

Add `settings.legacy.*` keys and plural families for counts in both locales. Replace
`notice.localDataTitle/Body/Ack` with `notice.legacyImportedTitle`, `legacyImportedBody`,
`legacyImportedKeptBody`, `legacyFailedTitle`, `legacyFailedBody`, and `legacyAck`. Keep the
`notice` namespace in the required-namespace list.

## Out of scope

- Deriving `pack_introductions`; unlocks rebuild from progress.
- Importing buddy name, avatar, topic, or locale.
- Importing device flags.
- Facilitator content or JSON import.
- Local data from a different origin.
- Any schema migration or schema change.
- Account self-deletion.

## Acceptance criteria

- [x] A signed-in identity with a cloud profile and Mission 1 data imports automatically on the
      first boot, before `checkProfileAtBoot`, and the notice reports the counts.
- [x] A new identity's import runs immediately after character creation, and the Home screen shows
      the imported counters.
- [x] The legacy database is deleted only after a successful import or an explicit discard; a
      failed import leaves it untouched and retries on the next boot.
- [x] A Settings fallback card appears while data remains (failed, deferred, unreadable, or empty)
      and offers the applicable Retry/Discard actions.
- [x] The merge follows the three rules above; a replayed payload changes nothing, including
      `masteryXpAwarded`.
- [x] Unknown word ids and unknown metric names are skipped and counted; the request still
      succeeds.
- [x] An anonymous caller gets `401`; a caller without a profile gets `404`; a malformed or
      oversized payload gets `422` with nothing written.
- [x] Two identities importing on the same device never touch each other's rows.
- [x] A second tab holding the database open produces the blocked-deletion message, not data loss.
- [x] No migration and no schema change.

## Test plan

Implemented at the project's tiers:

- **Shared unit** — `src/shared/test/legacyImport.test.ts`: mapper, validator, rank tie-breaks,
  mastery OR, profile counter merge, `hasImportableData`.
- **Client orchestration unit** — `src/page/test/db/legacyImport.test.ts`: recording reader,
  remover, and provider double for the sequencing claims (absent, unreadable, deferred, imported,
  failed, blocked).
- **Provider unit** — `src/page/test/api/ApiProgressProvider.test.ts`: POST path and body, snapshot
  replacement, error propagation.
- **Worker unit** — `src/worker/test/app.test.ts`: `401` and `405` for the route.
- **Host tier** — `src/worker/test/userData.test.ts` against real D1: insert, merge, tie, mastery
  OR, idempotency, `404`, cross-user isolation, `422`, `200` plus `me`, skips, token ownership, and
  the 256 KiB cap. The merge SQL runs against the real engine here, so the database tier itself was
  not extended.
- **Storage unit** — `deleteLegacyDatabase` states; the reader is verified manually. No fake
  IndexedDB stands in for the store.
- **Manual** — the browser sequence below.

## Manual verification

1. Run `pnpm worker:dev` with local D1 migrated (including `InitData.sql`) and `pnpm dev`; sign in.
2. In the DevTools console, create `WordsWizardDB` v1 with `profiles`, `progress`, and `metrics`
   object stores and seed a profile, progress rows, and metrics.
3. **Existing profile**: reload. The automatic import runs, the notice reports the counts, the
   database is gone from Application → IndexedDB, and Home shows the merged XP.
4. **No profile**: reload. No import runs at boot; create the character; the import runs
   immediately and Home shows the imported counters.
5. **API failure**: stop the worker, reload with a cached sign-in, then start it. The failure
   notice appears at boot and the Settings card remains; Retry succeeds and deletes the database.
6. **Blocked deletion**: hold the database open in a second tab. The import succeeds but deletion
   is blocked; the notice says the data remains, the card offers removal, and closing the tab lets
   a retry finish.
7. **Unknown words**: a legacy word id not in D1 is skipped and counted, not failed.
8. **Prototype database**: a `profiles`-only database shows the unreadable card and can be
   discarded.
9. **Idempotency**: import twice from the card; `GET /v1/me` is unchanged.

## Documentation impact

These were updated with the implementation:

- `docs/PRD.md` §4 decision 3, §8.2, §8.3, and §8.5.
- `docs/privacy.md` and `src/page/public/privacy.html`.
- `README.md` "Local data" and `docs/develop/page.md`.
- `docs/develop/worker.md` (the `/v1/me/import` contract).
- The Mission 2 Definition of Done line about deleting Dexie data at boot, with a sequencing
  caveat marking the original rule as superseded.

## Risks

- IndexedDB is same-origin. Only devices that used Mission 1 on `words.nioh.uk` or
  `localhost:8443` can import; a changed domain makes the old data unreachable.
- Opening a missing database must abort the upgrade. Verify in a fresh browser profile that no
  `WordsWizardDB` appears and the card is absent.
- Deletion is blocked while another tab holds the database open.
- The default 64 KiB body cap is too small for a full history; this route needs 256 KiB.
- D1's bound-parameter and batch ceilings require chunking. Profile and metrics are atomic;
  progress is not.
- Legacy rows may predate fields; mapping defaults them rather than rejecting the import.
- Archived or missing word ids are skipped and counted.
- Several Mission 1 profiles on one device: the most recently practised one is imported; the rest
  remain until import or discard.
- An empty legacy database is not automatically deleted; the card offers Discard.
- `monthlyReview.strengthDelta` is signed; max is the agreed merge, not an average.
