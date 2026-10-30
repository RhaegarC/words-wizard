# Mission 2 — Sprint Goal: "Your buddy follows you"

> Status: **Planned — documentation only. No Mission 2 code has been written.**
> Source of truth: [docs/PRD.md](../PRD.md) v0.2 as amended by this mission. Where the PRD and a
> Mission 2 feature doc disagree, the Mission 2 doc wins until PRD v0.3 lands in feature 25.
> Baseline: Mission 1 (features 01–20) is shipped on `develop`; feature 17 content production
> continues inside this mission.

## Goal

Make Words Wizard online. A child signs in with Microsoft Entra ID, and their buddy, XP, streak,
progress, and settings live in Cloudflare D1 instead of one browser. Topics, packs, and words come
from the API rather than a bundled JSON file, so content can be corrected or extended without
shipping a new app build. Progress written on one device is visible on another.

Mission 1's offline-first posture is deliberately retired. The product requires a network
connection; there is no offline practice, no cached-content fallback, and no guest profile.

## What Mission 1 assumed, and what changes

| Mission 1 | Mission 2 |
|---|---|
| No backend, no accounts | Microsoft Entra ID sign-in; one identity = one profile |
| Content bundled as JSON in the SPA | D1 is authoritative; the SPA calls `GET /v1/content` |
| Progress in Dexie (IndexedDB) | Progress in D1, read and written through the Worker API |
| Works fully offline after first load | Online required; a blocking offline screen replaces boot |
| One device, one character | The same profile follows the identity across devices |
| No runtime network requests | The Pages app, the Worker API, and Microsoft Entra sign-in |
| Metrics are local-only counters | Metrics are per-user rows in D1, still not analytics |
| Cloudflare Pages only | Cloudflare Pages + a Worker on `wordsapi.nioh.uk` |

## Target topology

```
Browser (PWA, words.nioh.uk)
  ├─ MSAL ──redirect + PKCE──> login.microsoftonline.com/<tenant-id>
  ├─ GET  /v1/content ────────> Worker (wordsapi.nioh.uk) ──> D1 content tables
  ├─ GET  /v1/me ─────────────> Worker (Bearer JWT) ────────> D1 user tables
  ├─ POST /v1/me/sessions ────> Worker (one idempotent D1 batch)
  └─ static shell, locales, art ──> Cloudflare Pages
```

- `words.nioh.uk` — the Pages app; hash routes are unchanged.
- `wordsapi.nioh.uk` — the Worker; CORS allows only `https://words.nioh.uk` and
  `http://localhost:8443`.
- Avatar art stays static under `src/page/public/art/`; a word image is a URL in `words.image`,
  with R2 serving the file in a later sprint. D1 stores no artwork metadata.
- The repository is split into `src/page/` (SPA), `src/worker/` (API), and `src/shared/` (pure
  domain). Page and Worker never import each other.

## Definition of Done (whole mission)

- [ ] Phase 0 has landed: `src/page/`, `src/worker/`, and `src/shared/` exist, and the existing
      suite, build, and dev server behave exactly as before the move.
- [ ] An unauthenticated visitor sees a sign-in screen; a tenant account signs in through Entra with
      auth-code + PKCE, and a silent renew keeps the session alive until sign-out.
- [ ] A fresh identity gets no profile until character creation; the same identity on another device
      gets the same profile, XP, streak, progress, and settings.
- [ ] Content is fetched from `GET /v1/content`; bundled content JSON is gone; `ETag` / `304`
      works; every active topic, pack, word, and avatar row is served from D1, and archived rows
      are not.
- [ ] A word introduced in one pack is introduced anew in another; word mastery stays shared, and
      the next pack in a topic unlocks only when every word of the previous pack has been
      introduced for that user.
- [ ] A finished session commits exactly once in one D1 batch; replaying the same session id leaves
      every counter unchanged; a failed commit leaves no partial rows.
- [ ] A commit that cannot reach the API is parked in a `localStorage` outbox and applied once on
      reconnect; the UI tells the child it is waiting rather than losing the session.
- [ ] The app boots online-only: no network or no API produces a clear retry screen, not a partial
      app.
- [ ] Local Dexie data is deleted once on first load of the new version, with a one-time notice.
- [ ] A signed-in child can re-customise the buddy, change topic and locale, export their data, and
      read a short bilingual privacy note. There is no delete or reset control.
- [ ] `wordsapi.nioh.uk/health` answers; `words.nioh.uk` serves the app; CORS rejects an unlisted
      origin; a real Entra token is accepted and a forged one is rejected.
- [ ] The Worker and page deploy from Workers Builds / Pages Git integration with no Cloudflare
      deploy secret in GitHub.
- [ ] Tests follow the project's tier model: unit, model, local D1 database, host, and a
      credential-gated remote D1 run. The content-integrity gate assembles the bundle from D1 and
      runs `validateContent`.
- [ ] PRD v0.3, `docs/operations.md`, `docs/privacy.md`, the README, and this sprint index describe
      what actually shipped; Mission 1 docs are marked historical.
- [ ] Feature 17's final-dataset gate passes against D1 before any public release.

## Phase 0 — repository restructure (chore PR, not a numbered feature)

A pure move with no behaviour change, merged to `develop` before feature 21 starts.

- [x] `src/page/` holds the SPA: `index.html`, `main.tsx`, `App.tsx`, `public/`, `components/`,
      `screens/`, `shell/`, `i18n/`, `router/`, `session/`, `modes/`, `pwa/`, `dev/`, `db/`,
      `content/`, `scripts/`, and the page-only domain modules (`firstRun`, `settings`, `install`).
- [x] `src/shared/` holds pure domain code: `types`, `config`, `progression`, `session`,
      `character`, `sessionPayload`, `metrics`, `provider`, `device`, and the pure `content/`
      modules (`types`, `validate`, `artwork`). It imports nothing from `page/` or `worker/`. The
      authoring data and rules stay under `page/content/` until feature 22 moves the rules to
      `shared/content/rules/`.
- [x] `src/worker/` exists as the new Worker tree; feature 21 fills it.
- [x] Vite runs with `root: "page"`, `publicDir: "public"`, `build.outDir: "../dist"`; aliases are
      `@` → `page` and `@shared` → `shared`.
- [x] Vitest configuration is split out of `vite.config.ts`; TS configuration is split into
      base/page/worker/test; `pnpm typecheck` covers page and tests (worker joins in feature 21).
- [x] Script paths (`validate:content`, `extract:wordlist`, `check:dist`, `check:deploy`) and the
      doc-assertion path arithmetic point at the new locations.
- [x] `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm check:dist` match the pre-move result;
      the only expected red is the existing `deployment-config.test.ts` policy failure caused by
      `delete-preview.yml`, which feature 25 rewrites.
- [x] A manual dev-server smoke shows the same screens and behaviour as before the move.
- [x] No file under `Figma/` is touched.

## Feature table

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 0 | Repository restructure into `page/`, `worker/`, `shared/` | Done | — |
| 21 | [Worker foundation & Entra token validation](archive/21-worker-foundation.md) | Done | Phase 0 |
| 22 | [D1 content store & content API](archive/22-d1-content-store.md) | Done | 21 |
| 23 | [User profile, progress & session commit](archive/23-user-data-api.md) | Done | 21, 22 |
| 24 | [Client online integration](24-client-online-integration.md) | In review | 22, 23 |
| 25 | [Deployment, domains & documentation](25-deployment-and-docs.md) | Planned | 21–24 |
| 17 | [Content production](17-content-production.md) — D1 vocabulary authoring via reviewed migrations | In progress | 22 |

Completed feature files move to [`archive/`](archive/); the table keeps the row for history.

## Vertical slice map

```
Phase 0  restructure (chore PR)
  └─► 21  Worker foundation + Entra token validation
        └─► 22  D1 content schema + GET /v1/content
              ├─► 23  user data API: /v1/me, profile, sessions, metrics, care
              │     └─► 24  client: MSAL, loader, API provider, outbox, Dexie removal
              │           └─► 25  domains, Workers Builds, CI, PRD v0.3, operations
              └─► 17  author remaining words/art as content migrations (parallel)
```

## Sequencing caveats

- **Phase 0 first.** Every Mission 2 branch cuts from a `develop` that already has the new layout;
  otherwise every later diff conflicts on paths.
- **Feature 21 before 22 and 23.** The API edge and token verifier are the security boundary; user
  and content routes are added behind it.
- **22 deletes the bundled content JSON, but the client fetch lands in 24.** Between those merges
  the SPA builds and typechecks but cannot load real content. Do not deploy `develop` to
  production in that window; the production URL stays on the last Mission 1 build until 24 lands.
- **22 owns the session-builder rewrite.** `Topic.packIds` and `Pack.unlockRule` disappear with the
  content model, so `buildSession` moves to sequential per-pack completion in 22. Until 23 stores
  introductions and 24 supplies them, 22 derives a per-pack introduced set from existing progress;
  that fallback is deleted in 24.
- **23 adds the API but leaves the page on Dexie.** It defines the server-side DTOs and adapts the
  shared session-payload validation to the server shape; the page's identity types stay numeric
  until feature 24 unifies them as Entra `oid` strings.
- **Only 24 makes `develop` deployable again.** It is the first merge where sign-in, content, and
  progress all come from the real services.
- **25 is the only feature that applies migrations to the production database and creates the
  custom domains.** Earlier features verify against local D1 and the credential-gated remote test
  database, never production.
- **No branch preview environments.** Pages previews stay off; `delete-preview.yml` stays as a
  no-op safety net until feature 25 decides its final form.
- **Feature 17 must pass the final gate before release.** Mission 2 is functional with the current
  dev dataset, but it is not the product until the D1 content set is complete and validated.
- **Mission 1 docs are historical.** The PRD's "no backend / no accounts / offline" sections are
  superseded here; feature 25 rewrites them. Until then, cite this sprint and the feature docs.

## Out of scope

Guest mode, offline practice or cached content fallback, multiple profiles per identity, profile
switcher UI, parent/teacher dashboards, content CMS or admin UI, import, account self-deletion,
push notifications, badges/achievements, recorded audio, speech recognition, branch preview
environments, and any analytics beyond the existing per-user counters. Deletion is an operator
procedure, not a product feature. The admin portal is deferred to
[Mission 3](00-mission-3-sprint.md).
