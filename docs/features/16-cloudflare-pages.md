# Feature 16 — Cloudflare Pages Deployment & CI

> Priority: Must · Mission 1 · **Status: In review**
> Depends on: 01, 04, 15

## Summary

Publish the static build to **Cloudflare Pages** through Cloudflare's **Git integration**:
Cloudflare builds the repository itself and serves the result over its global network with
automatic HTTPS, applying the cache policy declared in `_headers`. There is no server, no API,
no runtime secret, and no Cloudflare credential in this repository: hash routing means every deep
link is a fragment, so no SPA rewrite is needed and a request for a missing file returns a real
404.

Deployment runs from `master`. Feature PRs still target `develop`; promoting `develop` → `master` is
the release action. Pull-request preview environments are deliberately **not** enabled — a
preview URL would serve the dev dataset and its service worker before feature 17 lands.

## User story

As a **developer**, merging a release builds, tests, validates, and publishes the app without a
manual deploy. As a **parent**, the installed app updates from the same URL without reinstalling.

## Acceptance criteria

- [ ] A Cloudflare Pages project (Free plan, **Git integration**) is connected to
      `RhaegarC/words-wizard`; its production URL is the default `https://words-wizard.pages.dev`
      over HTTPS and its production branch is `master`. Root directory is `src`, the build command
      is `pnpm build`, the output directory is `dist`, the build image uses Node 22 + pnpm 10, and
      preview deployments are disabled.
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
- [x] There is **no** GitHub deployment workflow and no cloud credential in the repository:
      Cloudflare's Git integration builds and deploys on push to `master`, and owns the
      credentials. `wrangler` is not a project dependency.
- [x] No `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or other deployment secret is referenced
      by any workflow; no credential is committed and no runtime secret is used.
- [x] `src/scripts/check-dist.mjs` fails the build when `index.html`, the manifest, `sw.js`, hashed
      JS/CSS, locales, the icon set, or `_headers` are missing. It also asserts `sw.js` references a
      precache manifest, `_headers` parses with every cache class present and no path matching more
      than one rule, and `index.html` carries no absolute `/assets/` URLs.
- [x] `pnpm check:deploy` fetches `/`, one hashed asset, and one `.webp` from the deployed URL and
      asserts `200` with the expected `Content-Type` and `Cache-Control`. It is the on-demand
      post-deploy smoke check; it intentionally fails until feature 17 supplies artwork.
- [x] Rollback is a Cloudflare Pages deployment rollback (instant, from the project's deployment
      history) or a redeploy of an older commit; the app holds no server-side state.
- [x] The README documents the project settings, the default URL, the absence of deployment
      secrets, the `develop` → `master` release flow, and the rollback path.
- [x] Custom domains are documented as a Cloudflare Pages project setting (automatic TLS), not part
      of this feature.

## Tasks (ordered)

1. Connect the Cloudflare Pages project (`words-wizard`) to `RhaegarC/words-wizard`. Set the
   production branch to `master`, root directory `src`, build command `pnpm build`, output
   directory `dist`, Node 22 + pnpm 10, and disable preview deployments.
2. Do not create a deployment workflow or commit a Cloudflare token: the Git integration owns the
   build and its credentials.
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
   Cloudflare serves files from the build output and infers MIME types from the extension, so there
   is no per-extension configuration. Do not add `_redirects`: the hash router never asks the server
   for a second document.
4. Add `src/scripts/check-dist.mjs` (Node, no deps): required files, precache manifest, `_headers`
   classes and non-overlapping patterns, no absolute `/assets/` URLs in `index.html`; it inspects
   `src/dist/`.
5. Add `src/scripts/check-deploy.mjs` (Node, no deps, `fetch`): request the deployed URL with
   `HEAD`/`GET`, assert status, `content-type`, and `cache-control` for `/`, a hashed asset, and a
   `.webp`. Expose it as `check:deploy` for an on-demand post-deploy run.
6. Wire the `check:dist` and `check:deploy` scripts in `src/package.json`; do not add Wrangler.
7. Write `.github/workflows/ci.yml`: pnpm setup with cache, frozen install, typecheck, test,
   `validate:content`, build, `check:dist`.
8. Do not write a deployment workflow. Cloudflare builds and deploys from `master`; the repository
   stays free of cloud credentials.
9. Merge a known commit to `master` and let the Cloudflare build run; inspect the deployed headers
   and run `pnpm check:deploy`.
10. Document the project settings, URL, release flow, and rollback in `README.md`.

## Tests

**Unit (Vitest, always offline):**

- `headers.test.ts` reads `src/public/_headers` and asserts every cache class in the acceptance
  criteria has a rule and that no path matches two rules. This is a file-property test: it goes red
  when a rule is deleted or an overlapping wildcard is added.
- `deployment-config.test.ts` asserts no `_redirects` file exists in `src/public/` (the hash router
  needs no rewrite), that the CI workflow runs the full check set, and that no workflow deploys
  directly or references a Cloudflare credential. These are `doc-assertion` tests of configuration
  the suite cannot otherwise exercise.

**Build/CI (real):**

- `check:dist` passes on a real build and fails when `sw.js`, `index.html`, or `_headers` is removed.
- `ci.yml` is green on a pull request; the Cloudflare Pages production build is green on `master`.

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
- No blue/green or canary traffic split; rollback is a Pages deployment rollback or a redeploy of an
  older commit.
