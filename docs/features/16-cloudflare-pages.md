# Feature 16 — Cloudflare Pages Deployment & CI

> Priority: Must · Mission 1 · **Status: In review**
> Depends on: 01, 04, 15

## Summary

Publish the static build to **Cloudflare Pages** from GitHub Actions. A direct-upload Pages
project receives the prebuilt `src/dist/`; Cloudflare serves it over its global network with
automatic HTTPS and applies the cache policy declared in `_headers`. There is no server, no API,
and no runtime secret: hash routing means every deep link is a fragment, so no SPA rewrite is
needed and a request for a missing file returns a real 404.

Deployment runs from `master`. Feature PRs still target `develop`; promoting `develop` → `master` is
the release action. Pull-request preview environments are deliberately **not** configured — a
preview URL would serve the dev dataset and its service worker before feature 17 lands.

## User story

As a **developer**, merging a release builds, tests, validates, and publishes the app without a
manual upload. As a **parent**, the installed app updates from the same URL without reinstalling.

## Acceptance criteria

- [ ] A Cloudflare Pages project (Free plan, **Direct Upload**) exists for `RhaegarC/words-wizard`;
      its production URL is the default `https://<project>.pages.dev` over HTTPS and its production
      branch is `master`.
- [x] `pnpm build` produces `src/dist/` with relative asset URLs (`base: "./"`), so the build also
      works if served from a sub-path.
- [x] `src/public/_headers` is copied into `src/dist/_headers` and declares the cache classes.
      The path patterns do not overlap, so no response inherits two `Cache-Control` values
      (Cloudflare joins duplicate header names with a comma rather than overriding):
      - `/assets/*` → `public, max-age=31536000, immutable`;
      - `/icons/*`, `/art/*`, `/favicon.svg` → `public, max-age=604800`;
      - `/locales/*` → `public, max-age=3600`;
      - `/`, `/index.html`, `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` → `no-cache`.
- [x] There is **no** `_redirects` file and no catch-all rewrite. Hash routing means the server only
      ever returns `/index.html`; a missing asset keeps a real 404, and no client route depends on a
      server rewrite.
- [x] `.github/workflows/ci.yml` runs on pull requests to `develop`: install (pnpm, frozen lockfile),
      `typecheck`, `test`, `validate:content`, `build`, and `check:dist`. All pnpm steps run with
      `working-directory: src`; the package manifest lives there.
- [x] `.github/workflows/deploy.yml` runs on push to `master` and on `workflow_dispatch`: the same
      checks, then uploads the **prebuilt** `src/dist/` by running
      `wrangler pages deploy dist --project-name words-wizard --branch master` with
      `working-directory: src`, so the deployment never re-runs a build. Wrangler is pinned as a
      dev dependency in `src/package.json`.
- [x] Deployment credentials come from the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
      repository secrets; the token is scoped to **Cloudflare Pages: Edit** for the account. No
      credential is committed and no runtime secret is used.
- [x] `src/scripts/check-dist.mjs` fails the build when `index.html`, the manifest, `sw.js`, hashed
      JS/CSS, locales, the icon set, or `_headers` are missing. It also asserts `sw.js` references a
      precache manifest, `_headers` parses with every cache class present and no path matching more
      than one rule, and `index.html` carries no absolute `/assets/` URLs.
- [x] A post-deploy smoke step fetches `/`, one hashed asset, and one `.webp` and asserts `200` with
      the expected `Content-Type` and `Cache-Control`.
- [x] Rollback is a Cloudflare Pages deployment rollback (instant, from the project's deployment
      history) or re-running the deployment workflow on an older commit; the app holds no
      server-side state.
- [x] The README documents both repository secrets, the default URL, the `develop` → `master`
      release flow, and the rollback path.
- [x] Custom domains are documented as a Cloudflare Pages project setting (automatic TLS), not part
      of this feature.

## Tasks (ordered)

1. Create a Cloudflare Pages project with **Direct Upload** for `RhaegarC/words-wizard`; record the
   default `*.pages.dev` URL and confirm the production branch is `master`.
2. Create a Cloudflare API token scoped to **Cloudflare Pages: Edit** for the account and store it,
   with the account id, as the repository secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`.
3. Add `src/public/_headers`. The patterns below do not overlap — Cloudflare applies *every*
   matching rule and comma-joins duplicate header names, so a broad rule covering a no-cache
   path would corrupt its `Cache-Control`:
   ```
   /assets/*
     Cache-Control: public, max-age=31536000, immutable

   /icons/*
     Cache-Control: public, max-age=604800

   /art/*
     Cache-Control: public, max-age=604800

   /favicon.svg
     Cache-Control: public, max-age=604800

   /locales/*
     Cache-Control: public, max-age=3600

   /
     Cache-Control: no-cache

   /index.html
     Cache-Control: no-cache

   /sw.js
     Cache-Control: no-cache

   /registerSW.js
     Cache-Control: no-cache

   /manifest.webmanifest
     Cache-Control: no-cache
   ```
   Cloudflare serves files from the uploaded directory and infers MIME types from the extension, so
   there is no per-extension upload step. Do not add `_redirects`: the hash router never asks the
   server for a second document.
4. Add `src/scripts/check-dist.mjs` (Node, no deps): required files, precache manifest, `_headers`
   classes and non-overlapping patterns, no absolute `/assets/` URLs in `index.html`; it inspects
   `src/dist/`.
5. Add `src/scripts/check-deploy.mjs` (Node, no deps, `fetch`): request the deployed URL with
   `HEAD`/`GET`, assert status, `content-type`, and `cache-control` for `/`, a hashed asset, and a
   `.webp`.
6. Add `wrangler` as a pinned dev dependency in `src/package.json` and wire the `check:dist` script.
7. Write `.github/workflows/ci.yml`: pnpm setup with cache, frozen install, typecheck, test,
   `validate:content`, build, `check:dist`.
8. Write `.github/workflows/deploy.yml`: `permissions: contents: read`; the same checks, then the
   upload step with the two secrets. Do not add a `pull_request` trigger.
9. Run a manual `workflow_dispatch` deploy of a known commit; inspect the deployed headers.
10. Document the secrets, URL, release flow, and rollback in `README.md`.

## Tests

**Unit (Vitest, always offline):**

- `headers.test.ts` reads `src/public/_headers` and asserts every cache class in the acceptance
  criteria has a rule and that no path matches two rules. This is a file-property test: it goes red
  when a rule is deleted or an overlapping wildcard is added.
- `deployment-config.test.ts` asserts no `_redirects` file exists in `src/public/` (the hash router
  needs no rewrite), and that `deploy.yml` carries no `pull_request` trigger. These are
  `doc-assertion` tests of configuration the suite cannot otherwise exercise.

**Build/CI (real):**

- `check:dist` passes on a real build and fails when `sw.js`, `index.html`, or `_headers` is removed.
- `ci.yml` is green on a pull request; `deploy.yml` is green on `workflow_dispatch`.

**Verification (manual, deployed URL):**

- Open the default endpoint; the app boots and the service worker registers.
- Deep-link `#/words?tab=wordbook` and reload: the app opens on that tab.
- `curl -I` shows `text/html` + `no-cache` for `/` and `/index.html`,
  `application/javascript` + `immutable` for a hashed asset, and `image/webp` + 7 days for art.
- `curl -I` on a non-existent asset returns `404`, not `index.html`.
- Install from the deployed URL on iPad Safari; go offline; cold-start.
- Deploy a second build; the installed app shows the update prompt.

## Non-goals

- No custom domain or DNS in this feature; Cloudflare Pages attaches a custom domain with automatic
  TLS when a domain exists.
- No pull-request preview deployments — they would publish the dev dataset and its service worker
  before feature 17.
- No Cloudflare Workers, Pages Functions, server-side rendering, API, database, authentication, or
  Zero Trust.
- No blue/green or canary traffic split; rollback is a Pages deployment rollback or re-running the
  workflow on an older commit.
