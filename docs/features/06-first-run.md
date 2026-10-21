# Feature 06 — First Run: Character Creation & Topic Picker

> Priority: Must · Mission 1 · **Status: Not started**
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

- [ ] Boot with no profile with a character routes to `#/create`; every other route is unreachable
      until creation completes.
- [ ] Name field: trimmed, non-empty, **maximum 16 characters** counted as Unicode code points;
      16 is accepted, 17 is rejected with inline copy; control characters and line breaks are
      rejected; Chinese characters are allowed; suggestions are offered but not required.
- [ ] `profile.name` defaults to the same value as `characterName`; both are stored.
- [ ] Avatar picker shows exactly three built-in avatars (`luma`, `pippin`, `moss`), each with stage-1
      art or the styled placeholder; only an allowlisted id can be submitted.
- [ ] Confirm creates the profile with:
      `xp: 0`, `createdAt: now`, `lastPracticeAt: now`, `lastWakeAt: null`, `frozenDays: 0`,
      `careTokens: 0`, `sessionsSinceLastToken: 0`, `completedSessions: 0`, `streakCount: 0`,
      `bestStreak: 0`, `lastStreakDate: null`, `lastMonthlyReviewAt: null`, `currentTopicId: null`,
      `locale` from feature 03's device default.
- [ ] Creation is idempotent: a double tap or a reload mid-submit never creates a second profile.
- [ ] After creation, the flow is: Install Prompt (feature 15) → Topic Picker → Home. Until feature
      15 lands, the placeholder step is skipped and the picker follows directly.
- [ ] Topic Picker shows all five topics with icon, English title, Chinese title, and a short
      description in the active locale; all five are selectable from the start.
- [ ] Choosing a topic sets `Profile.currentTopicId` and routes to `#/home`; cancelling/back does not
      leave an unset topic behind on the next boot (returning to the picker is allowed).
- [ ] Re-customization in Settings changes name/avatar but never resets `createdAt`,
      `lastPracticeAt`, or any progress.
- [ ] All copy is bilingual and the screen works offline.
- [ ] Creation works with the keyboard alone and with a screen reader (labels, focus order).

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

## Non-goals

- No profile switcher, no multi-child setup, no account or sign-in.
- No topic locking: all five topics are open from the start.
- No animation beyond the design system's defaults.
