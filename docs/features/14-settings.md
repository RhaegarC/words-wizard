# Feature 14 — Settings, Export & Diagnostics

> Priority: Must · Mission 1 · **Status: In review**
> Depends on: 03, 05, 06, 09, 10

## Summary

A small, child-safe settings screen: language, buddy customization, topic change, a JSON backup for
the facilitator, and a diagnostics view that answers "is my data safe on this device?". There is no
account, no import, and no destructive action.

## User story

As a **child**, I can change my buddy's name or avatar and switch the language. As a **parent**, I can
export a backup and check whether the app is installed and has persistent storage.

## Acceptance criteria

- [x] **Language:** an EN / 中文 toggle updates `Profile.locale`, re-renders immediately, persists
      across reloads, and updates `<html lang>` and speech language.
- [x] **Re-customize:** edit `characterName` and `avatar` with the same validation as creation
      (1–16 code points, avatar allowlist). It never resets `createdAt`, `lastPracticeAt`, progress,
      streak, or tokens.
- [x] **Change topic:** opens the Topic Picker; selecting a topic updates `currentTopicId`. Progress
      and pack unlocks are per topic and are not reset.
- [x] **Export JSON:** downloads one file named `words-wizard-backup-YYYY-MM-DD.json` containing
      `{ schemaVersion, contentVersion, appVersion, exportedAt, profile, progress, metrics, device }`.
      No network request is made.
- [x] The export includes enough to inspect progress (per-word status, strength, counts, timestamps)
      and local metrics; it is a backup, not an import format (import is Phase 3).
- [x] **Diagnostics:** installed status, `persist()` result, `navigator.storage.estimate()` usage and
      quota, speech availability, profile count, progress row count, and the local counters from
      PRD §15.
- [x] Diagnostics never displays a raw word list or a child's name in a shareable format beyond the
      explicit export action.
- [x] **Install status / update:** shows "Installed" or "Browser tab"; a pending service-worker update
      (feature 15) surfaces here as well as on Home.
- [x] No destructive controls: no delete profile, no clear progress, no reset.
- [x] Every setting works offline and survives a reload.
- [x] Copy is bilingual; settings labels are short enough for a 390 px width.

## Tasks (ordered)

1. Build the Settings shell and sections: Language, Buddy, Topic, Backup, Diagnostics, About.
2. Implement the locale toggle against `setLocale` from feature 03.
3. Build the re-customize form, reusing `validateCharacterName` and `validateAvatarId` from feature 06.
4. Add the change-topic entry; reuse the picker from feature 06 in "change" mode (back returns to
   Settings).
5. Implement `buildExport(profile, progress, metrics, device, meta, now)` — pure payload builder with
   versions and timestamp.
6. Implement the download helper: `Blob` + object URL + `<a download>`; revoke the URL afterwards.
7. Build the diagnostics view: read `persist` result, `storage.estimate()`, speech flag, row counts,
   and counters; refresh on open.
8. Add install/update status slots for feature 15.
9. Add the About block: app version, content version, licence link, "no accounts, no tracking" copy.
10. Add i18n keys and a responsive check.
11. Manual export: open the file and confirm it round-trips as valid JSON with the expected keys.

## Tests

**Unit (Vitest):**

- `buildExport` — includes all sections; `exportedAt` is the passed timestamp; versions come from
  content/meta and package; the payload contains no functions, `undefined`, or Dexie objects.
- Re-customization validation — 16/17 code points, unknown avatar id, empty name → the same results
  as feature 06.
- Filename — local date formatting, zero-padded month/day, no timezone shift.
- Diagnostics formatter — bytes → human units at boundaries (0, 999, 1024, 1 MB).

**Verification (manual):**

- Switch to 中文, reload, confirm the whole app is Chinese and `<html lang>` is `zh-Hans`.
- Rename and re-avatar the buddy; reload; progress and streak are unchanged.
- Change topic; pack unlock counts on Home reflect the new topic.
- Export on iPad Safari: the file downloads and opens as valid JSON.
- Diagnostics shows "Installed" in the Home Screen app and "Browser tab" in Safari.
- `persist()` result matches what the browser reports.

## Non-goals

- No import (Phase 3), no delete/reset, no parent lock or PIN.
- No data sync, no account, no sign-out.
- No advanced settings (timers, difficulty, audio toggles).
