# Feature 05 — Persistence Layer (Dexie)

> Priority: Must · Mission 1 · **Status: Not started**
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

- [ ] `src/db/db.ts` opens `WordsWizardDB` with the PRD §8.3 schema:
      `profiles: '++id, name, createdAt'`,
      `progress: '++id, profileId, wordId, status, nextReviewAt, &[profileId+wordId]'`,
      `metrics: '++id, profileId, name, updatedAt'`,
      `device: 'key'`.
- [ ] `Profile`, `Progress`, `Metric`, and `Device` records match PRD §8.3 exactly, including
      `lastPracticeAt: number` (set at creation), `lastWakeAt: number | null`,
      `masteryXpAwarded: boolean`, and `locale`.
- [ ] `ProgressProvider` exposes: `getProfile`, `createProfile`, `updateProfile`, `getProgress`,
      `getAllProgress`, `commitSession(payload)`, `incrementMetric`, `getMetrics`, `getDevice`,
      `setDevice`.
- [ ] `getProfile()` returns the single profile (lowest id) or `null`. There is no profile switcher.
- [ ] `commitSession(payload)` writes progress rows, profile fields, metrics, and device flags in
      **one** `db.transaction('rw', ...)`; a throw rolls back every write.
- [ ] `getProgress(profileId, wordId)` uses the compound index; `getAllProgress(profileId)` returns
      only that profile's rows.
- [ ] `navigator.storage.persist()` is called once on first launch; the boolean result is stored in
      `device.storagePersisted`. A previously recorded result is not re-requested every boot.
- [ ] Boot check: a profile with `characterName` present → normal flow; absent → `#/create` and a
      `profileAbsentAtBoot` increment when running installed.
- [ ] Post-session check: after a commit, re-read the profile; if it is gone, route to the graceful
      recovery entry point rather than showing a broken summary.
- [ ] `localStorage` is used for nothing except a version probe (if needed); no progress, profile,
      or metrics value lives there.
- [ ] Metric names are constants, not string literals at call sites.

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

## Non-goals

- No schema migrations beyond version 1.
- No cloud sync, no export (feature 14), no profile switcher.
- No fake-indexeddb test tier and no repository mock.
