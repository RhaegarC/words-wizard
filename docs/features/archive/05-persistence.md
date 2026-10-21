# Feature 05 — Persistence Layer (Dexie)

> Priority: Must · Mission 1 · **Status: Done — merged in PR #11**
> Depends on: 01

## Summary

Create the on-device store exactly as PRD §8.3: four Dexie tables (`profiles`, `progress`,
`metrics`, `device`), one row per `profileId + wordId` enforced by a unique compound index, and all
access behind a `ProgressProvider` interface so a future sync layer can replace Dexie without
touching screens.

There is **no fake IndexedDB in the suite**. A fake shadows the engine's invariants while appearing
to test them; persistence is proven in a real browser as a manual E2E, and the pure builders around
it are unit-tested.

## User story

As a **child**, my buddy and my progress are still there tomorrow. As a **developer**, every write
goes through one interface, and a session commits as one transaction or not at all.

## Acceptance criteria

- [x] `src/db/db.ts` opens `WordsWizardDB` with the PRD §8.3 schema:
      `profiles: '++id, name, createdAt'`,
      `progress: '++id, profileId, wordId, status, nextReviewAt, &[profileId+wordId]'`,
      `metrics: '++id, profileId, name, updatedAt'`,
      `device: 'key'`.
- [x] `Profile`, `Progress`, `Metric`, and `Device` records match PRD §8.3 exactly, including
      `lastPracticeAt: number` (set at creation), `lastWakeAt: number | null`,
      `masteryXpAwarded: boolean`, and `locale`.
- [x] `ProgressProvider` exposes: `getProfile`, `createProfile`, `updateProfile`, `getProgress`,
      `getAllProgress`, `commitSession(payload)`, `incrementMetric`, `getMetrics`, `getDevice`,
      `setDevice`.
- [x] `getProfile()` returns the single profile (lowest id) or `null`. There is no profile switcher.
- [x] `commitSession(payload)` writes progress rows, profile fields, metrics, and device flags in
      **one** `db.transaction('rw', ...)`; a throw rolls back every write.
- [x] `getProgress(profileId, wordId)` uses the compound index; `getAllProgress(profileId)` returns
      only that profile's rows.
- [x] `navigator.storage.persist()` is called once on first launch; the boolean result is stored in
      `device.storagePersisted`. A previously recorded result is not re-requested every boot.
- [x] Boot check: a profile with `characterName` present → normal flow; absent → `#/create` and a
      `profileAbsentAtBoot` increment when running installed.
- [x] Post-session check: after a commit, re-read the profile; if it is gone, route to the graceful
      recovery entry point rather than showing a broken summary.
- [x] `localStorage` is used for nothing except a version probe (if needed); no progress, profile,
      or metrics value lives there.
- [x] Metric names are constants, not string literals at call sites.

## Tasks (ordered)

1. Define `src/db/db.ts` with Dexie and the four tables; export typed table handles.
2. Define the `ProgressProvider` interface in `src/db/provider.ts` with the session payload type
   (shared with feature 09's payload builder).
3. Implement the Dexie provider: profile get/create/update, progress get/all, metric upsert,
   device get/set.
4. Implement `commitSession` as a single read-write transaction over `progress`, `profiles`,
   `metrics`, and `device`; validate the payload shape before opening the transaction.
5. Add `src/db/metrics.ts` with the metric-name constants from PRD §8.3/§15.
6. Add the persistence request: on first launch, `navigator.storage.persist()`, store the result,
   never block the UI on it.
7. Add `checkProfileAtBoot()` and `verifyProfileAfterSession()` returning discriminated results.
8. Wire boot check into the router guard from feature 02 (replace the stub).
9. Add a small dev-only diagnostics dump (`db` counts) used by feature 14; no UI yet.
10. Handle the prototype's demo database: the Figma prototype already created `WordsWizardDB` v1
    with a `profiles`-only schema. It is **not** a migration source. Document the one-time
    "clear site data" step for developers; do not add a migration for demo records.
11. Document the accepted loss window: a browser kill mid-session loses the in-memory session.

## Tests

**Unit (Vitest, pure only):**

- Metric-name constants are unique and match the counters listed in PRD §15.
- The session-payload validator accepts a complete payload and rejects: missing profileId, duplicate
  `wordId` entries, a `nextReviewAt` in the past, a strength outside `0..1`, a negative XP value.
- `verifyProfileAfterSession` maps `null` → `lost`, a record → `present`.

**Verification (manual, real IndexedDB — no fake):**

- Create a profile, reload, and confirm it is read back.
- Write a progress row for one word, reload, and confirm `getProgress` returns it.
- Throw inside a test build of `commitSession` and confirm no partial rows were written.
- Clear site data and confirm the app routes to `#/create` with the same "Let's make a new friend!"
  copy as first use.
- On iPad Safari: first launch calls `persist()`; the result appears in diagnostics (feature 14).
- Confirm there is no `localStorage` progress entry (DevTools → Application).

## Implementation notes

- `src/db/db.ts` — `WordsWizardDB` v1 with the four PRD §8.3 tables and the unique
  `&[profileId+wordId]` index; `defaultDb` is the single instance.
- `src/db/provider.ts` — `ProgressProvider`, `SessionCommitPayload`, and the
  `ProfilePatch`/`SessionProgressWrite` shapes feature 09 will build against.
- `src/db/dexieProvider.ts` — the Dexie implementation. `commitSession` validates the
  payload first, then writes progress, profile, metrics, and device in one `rw`
  transaction. A profile update that matches no row throws, which rolls back every row
  written earlier in the same transaction. Progress rows are upserted through the
  compound index, so a repeated commit updates rather than duplicates.
- `src/db/payload.ts` — pure validator for profile id, word ids, review timestamps,
  strength bounds, and XP.
- `src/db/metrics.ts` / `src/db/device.ts` — counter and device-key constants.
- `src/db/lifecycle.ts` — `profileAtBoot`, `verifyProfileAfterSession`,
  `checkProfileAtBoot`, `checkProfileAfterSession`, `ensureStoragePersistence`, and
  `isInstalled`. A profile whose `characterName` is empty is treated as absent, so
  creation repairs it.
- `src/db/diagnostics.ts` — row counts for feature 14.
- `src/db/index.ts` — exports `progressProvider`, the app's only store handle.
- `src/App.tsx` — the feature 02 stub is gone. Boot reads the profile once (shared across
  StrictMode's double mount so `profileAbsentAtBoot` cannot double-count), routes an
  absent profile to the canonical `#/create`, and requests persistence without blocking
  the render. A storage failure shows `errors.storageUnavailable`.
- `src/dev/RouteTable.tsx` + `src/dev/devStore.ts` — dev-only seed and reset buttons,
  writing through the real provider. They replace the sessionStorage profile stub.

### Prototype database

The Figma prototype created `WordsWizardDB` v1 with a `profiles`-only, demo-shaped
schema. It is not a migration source: Dexie refuses to open a version it did not create,
so a developer who ran the prototype must clear site data for the origin once. This is
documented in the README; no migration code exists for demo records.

### Accepted loss window

A session lives in memory until `commitSession` runs at its end. A browser kill or
force-quit mid-session loses that session; every previously committed session survives.
No partial commit is possible: validation happens before the transaction and any throw
inside it rolls back all four tables.

### Local storage

No profile, progress, or metric value is written to `localStorage`. The one key still
present is the feature 03 locale preference (`words-wizard.locale`), a display fallback
used before a profile exists; feature 06 will hydrate locale from `Profile.locale`, and
feature 14 owns the setting.

## Tests

**Unit (Vitest, pure only — no fake IndexedDB):** 109 tests pass across 15 files; 20 are
new for this feature.

- `db/metrics.test.ts` — the constants cover the PRD §15 counters exactly once, are
  unique, and use the dotted naming scheme.
- `db/payload.test.ts` — a complete payload and a minimal one validate; missing profile
  id, empty and duplicate word ids, a review timestamp before the commit, strength
  outside `0..1` (including `NaN`), and negative XP (earned or total) are rejected; the
  strength and review-time bounds are accepted; all issues are reported at once.
- `db/lifecycle.test.ts` — boot presence from a record, `null`, and an empty character
  name; post-session `present` and `lost` mapping.

**Verification (real IndexedDB in headless Edge, no fake):**

- A fresh database routes `#/home` to `#/create`; `storagePersisted` is recorded as a
  boolean, and `navigator.storage.persist()` is not called again once a result is
  recorded.
- Seeding a profile plus one commit through the dev route table survives a reload: the
  profile reads back, `getProgress` finds the row through the compound index, and the
  session metrics were written once.
- Committing the same word twice leaves one row with the newer strength.
- A commit whose profile is missing throws and leaves no progress row and no metric
  change — the transaction rolled back.
- An emulated standalone display mode makes an absent profile increment
  `profileAbsentAtBoot` once per boot.
- Clearing the database returns the app to `#/create`; `localStorage` holds no store
  data; `getProfile` returns the lowest id when a second row is inserted.

## Non-goals

- No schema migrations beyond version 1.
- No cloud sync, no export (feature 14), no profile switcher.
- No fake-indexeddb test tier and no repository mock.
