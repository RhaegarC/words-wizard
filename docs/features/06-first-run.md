# Feature 06 — First Run: Character Creation & Topic Picker

> Priority: Must · Mission 1 · **Status: Done — pending merge**
> Depends on: 02, 03, 04, 05

## Summary

The only blocking gate in the product: if no character exists, the child names one and picks one of
three built-in avatars before doing anything else. Confirming creates the profile and starts the
dormancy clock. After the install step (feature 15), the child picks one of the five topics; that
choice becomes `currentTopicId` and is changeable later in Settings.

## User story

As a **child**, I make a buddy and choose what kind of words I want to learn, and then I can start.
As a **returning child**, I am never asked to create a buddy again.

## Acceptance criteria

- [x] Boot with no profile with a character routes to `#/create`; every other route is unreachable
      until creation completes.
- [x] Name field: trimmed, non-empty, **maximum 16 characters** counted as Unicode code points;
      16 is accepted, 17 is rejected with inline copy; control characters and line breaks are
      rejected; Chinese characters are allowed; suggestions are offered but not required.
- [x] `profile.name` defaults to the same value as `characterName`; both are stored.
- [x] Avatar picker shows exactly three built-in avatars (`luma`, `pippin`, `moss`), each with stage-1
      art or the styled placeholder; only an allowlisted id can be submitted.
- [x] Confirm creates the profile with:
      `xp: 0`, `createdAt: now`, `lastPracticeAt: now`, `lastWakeAt: null`, `frozenDays: 0`,
      `careTokens: 0`, `sessionsSinceLastToken: 0`, `completedSessions: 0`, `streakCount: 0`,
      `bestStreak: 0`, `lastStreakDate: null`, `lastMonthlyReviewAt: null`, `currentTopicId: null`,
      `locale` from feature 03's device default.
- [x] Creation is idempotent: a double tap or a reload mid-submit never creates a second profile.
- [x] After creation, the flow is: Install Prompt (feature 15) → Topic Picker → Home. Until feature
      15 lands, the placeholder step is skipped and the picker follows directly.
- [x] Topic Picker shows all five topics with icon, English title, Chinese title, and a short
      description in the active locale; all five are selectable from the start.
- [x] Choosing a topic sets `Profile.currentTopicId` and routes to `#/home`; cancelling/back does not
      leave an unset topic behind on the next boot (returning to the picker is allowed).
- [x] Re-customization in Settings changes name/avatar but never resets `createdAt`,
      `lastPracticeAt`, or any progress.
- [x] All copy is bilingual and the screen works offline.
- [x] Creation works with the keyboard alone and with a screen reader (labels, focus order).

## Tasks (ordered)

1. Build the creation screen: name input, suggestions, avatar picker, confirm.
2. Implement `validateCharacterName(raw)` — trim; count Unicode code points (not UTF-16 units) for
   the 1–16 bound; reject whitespace-only, control characters, and line breaks; return a typed reason.
3. Implement `validateAvatarId(id)` against the avatar allowlist from `content/avatars.json`.
4. Implement `createProfile(input)` in the provider: single transaction, write defaults, return the
   profile; guard against a second write if one already exists.
5. Wire the boot guard: no profile → `#/create`; after success → `#/install` (placeholder until 15).
6. Build the Topic Picker screen from `getTopics()`; show pack count and mastery progress (0 at first
   run; feature 09 supplies the real count later).
7. Implement `setCurrentTopic(topicId)` against the provider, validating the id exists.
8. Add the returning-first-run case: if `currentTopicId` is null on Home, route to the picker rather
   than guessing a topic.
9. Add i18n keys for all copy, including validation messages and avatar names.
10. Manual pass on iPad Safari and Edge: create, kill the app, reopen, land on Home.

## Tests

**Unit (Vitest):**

- `validateCharacterName` — `""`, `"   "`, 1 char, 16 chars, 17 chars, a 16-character Chinese name,
  an emoji, a newline, a control character, and leading/trailing spaces; returns accept/reject with
  the right reason.
- `validateAvatarId` — each of the three ids accepted; `"../../evil"`, `""`, `"Luma"` rejected.
- `buildNewProfile(input, now, locale)` — all defaults exactly as listed above; `lastPracticeAt`
  equals `createdAt`.
- `setCurrentTopic` — a known id updates the profile; an unknown id is rejected.

**Verification (manual):**

- First launch on a clean profile store shows creation; every hash route redirects to it.
- 16-character name accepted, 17 blocked, error copy in the active language.
- Confirm twice quickly creates one profile.
- Pick each topic; Home reflects the choice after a reload.
- No way to reach practice without a character.

## Implementation notes

- `src/domain/firstRun.ts` — `validateCharacterName` (trim, 1–16 code points,
  control/line-break rejection), `validateAvatarId` against the bundled set,
  `buildNewProfile` with every PRD default (`currentTopicId: null`), and
  `resolveTopicChoice`, which returns a patch only for a bundled topic id.
- `src/screens/CreateScreen.tsx` — name field with hints and suggestions, three
  avatar radios (styled placeholder tiles; stage art arrives with feature 17), inline
  errors, and a guarded submit. The provider call is idempotent, so a double tap can
  never add a second profile.
- `src/screens/TopicPickerScreen.tsx` — all five topics with icon, both titles, the
  active-locale description, pack count, and a zero mastery count until feature 09
  supplies real progress.
- `src/db/dexieProvider.ts` — `createProfile` now runs in one read-write transaction and
  returns the existing profile instead of adding a second; it returns the stored
  `Profile`, which the creation screen uses directly.
- `src/router/guard.ts` — `resolveRoute(route, hasProfile, hasTopic)`. A profile exists
  → `#/create` resolves away; no topic → every screen except the picker and install
  resolves to the picker.
- `src/App.tsx` — after boot, the fragment is kept in agreement with the guard: absent →
  `#/create`, present without a topic → `#/topics`, present with a topic and `#/create`
  → `#/home`. The picker hides the back affordance because it is the only way forward.
- `src/domain/types.ts` and PRD §8.3 — `Profile.currentTopicId` is `string | null`.
- Locale comes from `LocaleProvider`'s device default; `profile.locale` records it.
- The install step is skipped until feature 15, so creation goes straight to the picker.

## Tests

**Unit (Vitest):** 133 tests pass across 16 files; 24 are new for this feature.

- `domain/firstRun.test.ts` — empty/whitespace rejection; 1, 16, and 17 code points; a
  16-character Chinese name; an emoji counted as one code point; trimming; newline and
  control-character rejection; all three avatars accepted and path-like, empty,
  mis-cased, and unknown ids rejected; the complete default profile with
  `lastPracticeAt === createdAt`; known and unknown topic choices.
- `router/guard.test.ts` — creation gated without a profile; existing routes preserved;
  `#/create` resolves away once a profile exists; a missing topic forces the picker while
  the picker and install step stay reachable.

**Verification (headless Edge, real IndexedDB):**

- A fresh device lands on `#/create`; empty, 17-character, and missing-avatar submits
  show their inline errors; a 16-character name passes.
- Creation stores the trimmed name in both `name` and `characterName`, the chosen avatar,
  `currentTopicId: null`, zero XP, `lastPracticeAt === createdAt`, every other default,
  and the active locale; calling `createProfile` again leaves one row.
- Creation routes to `#/topics`; all five topics render with both titles, pack count, and
  no lock; choosing one stores `currentTopicId` and lands on `#/home`.
- A reload at the picker stays at the picker; a reload after the choice stays at Home; a
  returning child opening `#/create` is sent to Home; `#/session` is reachable afterwards.
- A Chinese device default renders Chinese copy and Chinese topic titles; an avatar can
  be selected with the keyboard; no external runtime requests were made.

## Non-goals

- No profile switcher, no multi-child setup, no account or sign-in.
- No topic locking: all five topics are open from the start.
- No animation beyond the design system's defaults.
