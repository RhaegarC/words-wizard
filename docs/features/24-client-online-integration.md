# Feature 24 — Client Online Integration

> Priority: Must · Mission 2 · **Status: In review — PR [#62](https://github.com/RhaegarC/words-wizard/pull/62)**
> Depends on: 22 (content API), 23 (user API). Blocks: 25.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Connect the SPA to the real services. The app signs in with Microsoft Entra ID through MSAL, boots
only when content and the profile have loaded, reads and writes progress through the Worker, and
keeps a finished session in a `localStorage` outbox until the API confirms it. Dexie and every
bundled content import are removed; local Mission 1 data is discarded once, with a notice.

This is the feature that makes `develop` deployable again after feature 22 removed the bundled
content and feature 23 added the user API.

## User story

As a **child**, I sign in with my school account, see my buddy, and continue where I left off — on
this device or another. If the internet drops when I finish a session, the app tells me it is saving
and applies it when I reconnect, without counting it twice. As a **parent**, I can see who is signed
in, sign out, and read what is stored about my child.

## Boot order

`App.tsx` runs this sequence before rendering a route:

1. `msal.handleRedirectPromise()` — complete a returning sign-in.
2. No signed-in account → `#/signin`; a signed-in account on `#/signin` goes to `#/create` or
   `#/home`.
3. Signed in → `Promise.all([fetchContent(), fetchMe()])`. `fetchMe` returns the profile, progress,
   metrics, and pack introductions. Any failure (offline, API down, bad token that cannot be
   renewed) shows a retry screen with an offline/error message; nothing else renders.
4. `loadContent(bundle)` then the route guard: `profile === null` → `#/create`; otherwise `#/home`.
5. Drain the pending-commit outbox; a pending commit is applied before the home screen offers a new
   session.

The app is online-required. There is no cached content fallback, no offline practice, and no
degraded boot.

## Authentication

- `src/page/auth/msal.ts` builds a `PublicClientApplication` from build-time env:
  `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_SCOPE`, and
  `VITE_API_BASE_URL`. Missing values stop boot with a configuration error, not a blank screen.
- Authority is `https://login.microsoftonline.com/<tenant-id>`; redirect and post-logout redirect
  are `${window.location.origin}/`; cache is `localStorage`; `navigateToLoginRequestUrl` is true so a
  redirect sign-in returns to the route that started it; no client secret.
- Scopes are `openid`, `profile`, and the API scope (`api://<client-id>/access_as_user`).
- One `getAccessToken()` helper calls `acquireTokenSilent` for the active account and falls back to
  `acquireTokenRedirect` on `InteractionRequiredAuthError`. It never shows a popup.
- `AuthProvider` exposes `{ status, account, signIn, signOut, getAccessToken }`; screens do not call
  MSAL directly.
- The session persists across reloads until sign-out; there is no idle timeout.
- Sign-out asks for confirmation, then clears MSAL, the in-memory provider cache, and any pending
  outbox. If a commit is pending, the confirmation says it will be discarded. Sign-out never deletes
  D1 data.

## API provider

`src/page/api/ApiProgressProvider.ts` implements the existing `ProgressProvider` interface, so
screens and `SessionProvider` keep their shape:

| Method | Behaviour |
|---|---|
| `getProfile` / `getProgress` / `getAllProgress` / `getMetrics` / `getIntroductions` | Read the cached `GET /v1/me` snapshot; refresh on boot and after a write |
| `createProfile` | `POST /v1/me/profile`; an existing profile is returned, never a duplicate |
| `updateProfile` | `PATCH /v1/me/profile` with a whitelisted patch |
| `commitSession` | `POST /v1/me/sessions`; on a network/5xx failure, park the payload in the outbox |
| `incrementMetric` | `POST /v1/me/metrics` with a generated `eventId`; best-effort, at most one retry |
| `getDevice` / `setDevice` | `localStorage`, device flags only — never progress |

- Every request attaches `Authorization: Bearer` from `getAccessToken()`.
- A `401` triggers one silent token refresh and one retry; a second `401` returns to sign-in.
- A `422` from a commit is a client bug: show an error, do **not** enqueue it for endless retries.
- The provider caches the `/v1/me` snapshot in memory only; a reload re-fetches.
- `src/page/api/client.ts` owns `fetch`, base URL joining, the error envelope, and the auth header.

## Identity types

- `Profile.id`, `SessionProfile.id`, `Progress.profileId`, `Metric.profileId`, and every provider
  signature become `string` (the Entra `oid`).
- `sessionSeed` accepts a string; deterministic-seed tests update their fixtures.
- The temporary numeric compatibility seam introduced while the page still used Dexie (feature 23)
  is removed; there is one identity type from here on.
- No screen or domain function parses, increments, or otherwise treats the id as a number.

## Content loader

- `fetchContent()` calls `GET /v1/content` and validates that the response has the expected
  top-level keys before handing it to `loadContent(bundle)`.
- The browser's HTTP cache performs ETag revalidation; the client does not send `If-None-Match`
  itself, so a fresh boot never has to reconstruct a bundle from a bodiless `304`. The Worker still
  answers a conditional request correctly for the browser and any intermediary.
- The accessor API from feature 22 is unchanged; screens barely change.
- Content is requested once per boot; no content is persisted in IndexedDB or `localStorage`.
- A failed load is the retry screen, never an empty library.
- Word images come from `Word.image` (a URL, ultimately R2). A null image renders the `emoji`, then
  the first letter; there is no artwork manifest to consult.
- The provider keeps the pack introductions from `/v1/me` and passes them into `buildSession`, which
  uses them to decide the first unlocked pack and which words are already introduced. The
  progress-derived fallback named in feature 22 is deleted here.

## Outbox

`src/page/api/outbox.ts` stores pending session commits in
`localStorage["words-wizard.pendingCommits"]`, a map keyed by session id:

```ts
{ [sessionId]: { payload, queuedAt } }
```

- Enqueue only a finished-session commit that failed for a network, timeout, or 5xx reason.
- Drain on boot (after auth), on the browser `online` event, and from a Retry button.
- Delete the entry only after a 2xx; on `401`, pause, re-authenticate, then retry once.
- The summary screen states one of: saved, waiting to save, retry failed. A child never sees an
  unqualified "done" for a session that is only in the outbox.
- A payload that no longer validates after an app update is dropped with a message; it is not sent.
- The payload includes the session's `introductions`; a replay inserts none twice because the server
  keys them by `(user, pack, word)`.
- The outbox stores nothing except pending commit payloads, and it is cleared on sign-out.

## Dexie removal and local data

- Delete `src/page/db/db.ts`, `dexieProvider.ts`, and `index.ts`; adapt `lifecycle.ts`,
  `diagnostics.ts`, and `dev/devStore.ts` to the provider. Remove the `dexie` dependency.
- On first load of the new version, delete `WordsWizardDB` once through `indexedDB.deleteDatabase`,
  guarded by `localStorage["words-wizard.localDataDiscarded"]`, and show a one-time bilingual
  notice: local Mission 1 progress is not transferred.
- No migration of Dexie rows is attempted; there are no production users, and inventing a partial
  import would be worse than a clear reset.
- Diagnostics and export now read the API snapshot; no Dexie table is mentioned in the UI.

## Screens, routing, and copy

- New `#/signin` screen: bilingual sign-in button, a one-line explanation of what is stored, and an
  offline notice when the browser reports no network.
- The guard sends unauthenticated users to `#/signin` and signed-in users away from it.
- Settings gains an Account section (signed-in display name from the ID token, Sign out) and a
  privacy-note link; export, diagnostics, re-customisation, topic change, and locale remain.
- No delete, reset, or account-removal control.
- i18n adds an `auth` namespace and `errors.offline`, `errors.unauthorized`, and
  `errors.sessionSaveFailed`; both locales are updated and the key-parity test enforces it.

## PWA

- The service worker precaches the app shell, locales, icons, and manifest only; API responses are
  never precached.
- `/art/*` uses a runtime `CacheFirst` strategy for the remaining bundled art (avatar portraits);
  word images served from R2 get the same strategy with an expiration cap. Neither is an
  offline-practice path, and the offline screen still blocks boot.
- The update prompt and the waiting-worker behaviour from feature 15 are unchanged.
- Offline boot (no network, or content/me fetch failure) shows the blocking retry screen.

## Acceptance criteria

- [ ] Sign-in completes on `http://localhost:8443` and on the production origin with the registered
      redirect URIs; no popup and no client secret. *(manual — needs the registered Entra app)*
- [ ] A reload keeps the session; a silent renew refreshes the token before it expires. *(manual)*
- [x] Unauthenticated routes redirect to `#/signin`; signed-in users never see it.
- [ ] Content and `/v1/me` load in parallel; either failing shows the retry screen. *(manual — no
      DOM test tier)*
- [x] A fresh identity is sent to `#/create`; creating a character writes it through the API.
- [ ] A completed session commits through the API and the summary reflects the returned state.
      *(commit path tested at the provider/seam tier; summary rendering is manual)*
- [x] A completed session commits its introductions; the next pack unlocks only when every word of
      the previous pack has been introduced; introducing the same word in a second topic creates a
      second introduction without a second `progress` row.
- [x] A commit that fails for network/5xx is in the outbox, visible on the summary, and applied
      exactly once on reconnect; a replay changes no counter and adds no introduction.
- [x] A `401` re-authenticates once and retries; a second failure returns to sign-in.
- [ ] `localStorage` holds only device flags and the outbox; no profile or progress is persisted
      there. *(manual — inspect storage in the running app)*
- [x] `WordsWizardDB` is deleted once and the notice is shown; the `dexie` dependency is gone.
- [ ] Settings shows the account, signs out with confirmation, and links the privacy note. There is
      no delete/reset. *(manual)*
- [ ] The PWA still installs, updates through the prompt, and shows the offline screen instead of a
      partial app. *(manual)*
- [ ] Both locales pass key parity; the new copy is reviewed in Chinese. *(parity automated; Chinese
      review is the user's)*

## Tasks (ordered)

1. Add `@azure/msal-browser`; write `auth/msal.ts` and `AuthProvider` with the token helper and its
   unit tests (silent success, interaction-required fallback, no account).
2. Add `api/client.ts` and `api/ApiProgressProvider.ts`; migrate the provider tests from Dexie
   fixtures to a fake `fetch` for unit tests, keeping the store tier real in the seam test.
3. Add `api/outbox.ts` with enqueue/drain/clear/retry and its unit tests.
4. Add `api/content.ts` and the ETag handling; wire `loadContent` in boot.
5. Carry `introductions` from `/v1/me` through the provider into `buildSession`; delete the
   progress-derived fallback and update the session-builder tests.
6. Rewrite `App.tsx` boot order and `router/guard.ts` for auth states; add `SignInScreen`.
7. Change identity types to `string` across shared and page; update `sessionSeed` and deterministic
   tests.
8. Delete the Dexie modules and dependency; adapt lifecycle, diagnostics, and dev store; add the
   one-time database deletion and notice.
9. Update Settings (account, sign-out, privacy link) and the i18n catalogues.
10. Update the PWA config: shell-only precache, art and R2 image runtime cache, offline screen.
11. Add the client↔Worker↔D1 seam test.
12. Run the manual E2E checklist below and record it in the PR.

## Tests

| Tier | What it proves |
|---|---|
| **Unit** (always) | Token helper uses silent then redirect; guard maps auth/profile states to routes; provider maps API responses and error envelopes; outbox enqueues only retryable failures, drains once, clears on 2xx, pauses on 401, drops an invalid payload; content loader validates the bundle and rejects a malformed one; identity helpers accept strings and never parse numbers; `buildSession` uses introduction rows for sequential unlock and no longer derives them from progress. |
| **Host / seam** (always) | The `wrangler dev` harness from features 21–23 plus a local JWKS token: `ApiProgressProvider` fetches a real content bundle, creates a profile, commits a session with introductions, replays the outbox payload, and re-reads `/v1/me` — proving the client, Worker, and D1 agree on the contract and that the next pack unlocks. |
| **Manual** (per environment) | Real Entra sign-in and redirect; silent renew; two tenant accounts on one browser; a second device sees the same profile; offline boot; a commit parked and applied exactly once after reconnect; sign-out clears the browser session and leaves D1 untouched. |

The seam test exists because no other tier drives request → provider → Worker → D1 in one run. It is
the only place the client's wiring is proven end to end; the API tests prove the store and the
provider tests prove the mapping, but only this test proves they are wired to each other.

**RED-first hot spots**

- The guard and boot states (signed out, signed in without profile, signed in with profile, offline)
  before the router changes.
- Outbox enqueue/drain/replay before the provider uses it.
- The "401 refreshes once, second 401 signs out" test before the client retry logic.
- The sequential-unlock session tests (first pack only; the next unlocks at completion; a shared
  word introduced in a second topic) before the provider supplies introductions.
- The seam test before the provider is pointed at the harness.

## Non-goals

- No offline practice, cached-content fallback, or background sync.
- No guest mode, profile switcher, or account deletion.
- No server-side session resume; sessions still commit only at the end.
- No push notifications, analytics, or error reporting beyond the existing diagnostics.
- No UI redesign; the Figma Make layout and hash routes stay as they are.
