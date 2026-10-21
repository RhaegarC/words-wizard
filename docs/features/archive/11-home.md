# Feature 11 — Home Hub

> Priority: Must · Mission 1 · **Status: Done — merged in PR #25**
> Depends on: 06, 07, 09, 10

## Summary

Home is the answer to "what do I do now?" It shows the buddy, the streak, today's session, and the
few destinations that matter. It is a hub, not a dashboard: no raw XP number, no fifty stats, no
punitive red badges.

## User story

As a **child**, I open the app and immediately know whether to practice, see my words, or wake my
buddy. As a **returning child**, I can see my streak and that today's words are waiting.

## Acceptance criteria

- [x] Home renders the buddy using `deriveCharacterState` (feature 10), with stage art, stage progress,
      and vitality; tapping the buddy opens `#/character`.
- [x] The session card shows how many reviews and new words are waiting and a single **Practice** CTA
      that routes to `#/session`.
- [x] When the builder returns nothing, Home shows the caught-up state: "You're all caught up!", with
      a CTA to My Words or to change topic. No empty session is offered.
- [x] Streak and Care Token count are visible but quiet; a token progress hint appears only when one
      is close (for example, "2 more sessions for a Care Token").
- [x] Cards/links present: My Words, Settings (gear), change topic, and Monthly Review when due.
- [x] The Monthly Review card is non-blocking and routes to `#/review`; it is hidden when not due.
- [x] The sleepy/sleeping overlay (feature 10) appears when `state !== 'awake'` and offers both wake
      paths without blocking Practice.
- [x] The install prompt (feature 15) mounts here after creation and on every boot until installed;
      Home itself does not implement install logic.
- [x] A profile with `currentTopicId === null` routes to the Topic Picker rather than showing an
      empty session.
- [x] `buildHomeView()` is a pure function; the screen renders its output and performs no date math,
      no content lookup, and no threshold comparison inline.
- [x] No raw XP number is displayed anywhere on Home.
- [x] Layout works at 1024×768 (iPad landscape) and at 390×844; primary actions stay above the fold.
- [x] All copy is bilingual; no English literal in JSX except word content.

## Tasks (ordered)

1. Implement `buildHomeView({ profile, progress, content, now, config })` — stage, vitality, state,
   due/new counts, caughtUp, monthlyReviewDue, token progress.
2. Reuse `previewSession` from feature 07 for the due/new counts; do not duplicate builder rules.
3. Build the character header component (delegates to feature 10).
4. Build the session card with Practice / caught-up variants.
5. Build the quiet streak and token display.
6. Add the card grid: My Words, change topic, Settings.
7. Mount the Monthly Review card when `isMonthlyReviewDue` (stubbed until feature 13).
8. Mount the sleepy/sleeping overlay.
9. Mount the install prompt slot (empty until feature 15).
10. Add the null-topic redirect.
11. Add i18n keys and responsive layout checks.
12. Verify the whole loop manually: Home → session → summary → Home.

## Tests

**Unit (Vitest):**

- `buildHomeView` — counts match `previewSession`; caught-up when both counts are 0; null topic →
  picker; monthly review flag delegated; streak/token values come from the profile unchanged.
- No raw XP: a render-level assertion is not part of the unit tier; verified manually.
- Stage/vitality are exactly `deriveCharacterState` outputs (no second formula).

**Verification (manual):**

- First run lands on Home with the chosen topic after creation and topic picker.
- A full session and return to Home updates the stage bar, streak, and token hint.
- Simulate 7 idle days: the overlay appears, Practice still starts a session.
- Caught-up state appears when the dev content is exhausted.
- iPad landscape and a phone-width browser both keep Practice visible without scrolling.

## Non-goals

- No dashboard, charts, or history graphs.
- No badge shelf, leaderboard, or notifications.
- No install or update logic in this feature (15 owns it).
