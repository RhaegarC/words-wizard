# Bug 06 — My Words collection stays empty after a session

> Severity: Normal · Status: In review — PR [#104](https://github.com/RhaegarC/words-wizard/pull/104)
> Reported: 2026-11-18 · Feature: 12 (My Words) with 22 (content store) and 24 (client online integration)

## Summary

After a practice session completes, **My Words → Collection** still shows **0** and its empty
state ("Your word collection is waiting! Practice to add your first word."), with no learned word
listed. The Home screen's **Your collection** card shows the same zero. The session itself reports
words practised, and the progress is stored on the server — the app just never joins it to the
content bundle.

## Environment

- The online app, signed in with any profile
- A daily session completed through to its summary (any number of words)
- Content served from `GET /v1/content` and loaded during boot

## Steps to reproduce

1. Sign in, start a practice session, and answer the words through to the summary.
2. Let the commit finish.
3. Open **My Words** (`#/words`) or look at the **Your collection** card on Home.

## Expected

The collection lists the words that were practised, with a count greater than zero; the topic
breakdown and topic filter are populated. This is what the stored progress rows describe.

## Actual

The collection count is `0` and the empty state is shown. The topic filter offers only "All
topics", and the Home collection card also reads `0`. The Word Book is empty for the same reason.
Refreshing the page does not change it.

The session summary and the server are correct: `POST /v1/me/sessions` stores a `progress` row for
every planned word with at least one attempt, and `GET /v1/me` returns them.

## Triage

- **Data:** no progress is lost or written incorrectly. The rows are in D1, and the session
  commit's own tests and the `GET /v1/me` snapshot cover them. A later fix or refresh can render
  them; nothing has to be replayed.
- **Severity:** Normal — the learner's collection, topic breakdown, and Home count are unusable,
  but practice, scheduling, and stored progress are unaffected. It takes the `fix/*` path.

## Root cause

Two screens captured the content bundle in **module-scope constants**:

- `src/page/screens/WordsScreen.tsx` — `const WORDS = getAllWords()` and
  `const TOPICS = getTopics()` (also `TOPICS_BY_ID`)
- `src/page/screens/HomeScreen.tsx` — `const CONTENT = getHomeContent()`

The bundle is fetched **during boot**, after the module graph has been evaluated. At that point
`src/page/content/index.ts` has no loaded bundle, so these accessors return their frozen empty
fallbacks. The constants therefore point at an empty word list for the life of the page.

`getCollected` (and Home's `learnedCount`) join every progress row to a word by id and **skip a row
whose word is absent from the content it was given**. With an empty content list, every stored
word is skipped and the collection is empty by construction. Session screens call `getAllWords()`
while rendering, after boot, which is why practice works normally.

## Fix

- `WordsScreen` reads `getAllWords()` and `getTopics()` inside the component, on render, and builds
  its topic lookup from that render's list.
- `HomeScreen` passes `getHomeContent()` into `buildHomeView` on render instead of using the
  module-level snapshot.
- No other screen captures the bundle at module scope; the detail, topic-picker, and session
  screens already read it while rendering.

## Regression tests

- `src/page/test/screens/content-timing.test.ts` (source-level assertion) — no screen file may
  call `getHomeContent`, `getAllWords`, `getAllPacks`, `getTopics`, `getAvatarSet`, or the
  single-item accessors in a top-level `const`. It failed on the three captures above and passes
  once the screens read content at render. The test also asserts that screen files were actually
  scanned, so it cannot pass vacuously.

## Verification

- `pnpm typecheck` — clean.
- `pnpm test` — 79 files passed, 1 skipped; 1079 tests passed, 5 skipped (the skip is the
  credential-gated remote tier). The suite also carried a pre-existing doc-assertion failure from
  the recent deployment-info sync (`worker.md` documents `npx wrangler` while its test still
  expected bare `wrangler`); that test is aligned in this branch so CI can pass.
- `pnpm build`, `pnpm build:portal`, `pnpm check:dist` — pass.
- Manual: complete a session, open My Words, and confirm the practiced words and a non-zero count
  appear without a reload; Home's collection card agrees.
