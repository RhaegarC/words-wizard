# Feature 16 — Azure Deployment & CI

> Priority: Must · Mission 1 · **Status: Not started**
> Depends on: 01, 04, 15

## Summary

Publish the static build to Azure Blob Storage's `$web` container from GitHub Actions, with the MIME
types and cache headers a PWA needs. There is no server, no rewrite rule, and no runtime secret:
hash routing means every deep link is an `index.html` load, and all data is on the device.

Deployment runs from `master`. Feature PRs still target `develop`; promoting `develop` → `master` is
the release action.

## User story

As a **developer**, merging a release builds, tests, validates, and publishes the app without a manual
upload. As a **parent**, the installed app updates from the same URL without reinstalling.

## Acceptance criteria

- [ ] Azure Storage account has **static website** enabled with index and error document
      `index.html`; the site is served from `$web` over the default HTTPS endpoint.
- [ ] `pnpm build` produces `src/dist/` with relative asset URLs (`base: "./"`), so the build also
      works if served from a sub-path.
- [ ] `.github/workflows/ci.yml` runs on pull requests to `develop`: install (pnpm, frozen lockfile),
      `typecheck`, `test`, `validate:content`, `build`, and `check:dist`. All pnpm steps run with
      `working-directory: src`; the package manifest lives there.
- [ ] `.github/workflows/deploy.yml` runs on push to `master` and on `workflow_dispatch`: the same
      checks, then uploads the `src/dist/` build to `$web`.
- [ ] Authentication uses **GitHub OIDC** federated credentials (`azure/login`), not a stored storage
      key; only non-secret identifiers live in repository variables. No credential is ever committed.
- [ ] Upload sets MIME types explicitly per extension and cache headers per class:
      - hashed `assets/*` → `public, max-age=31536000, immutable`;
      - artwork and icons → `public, max-age=604800` (paths are not content-hashed);
      - `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest` → `no-cache`;
      - content/locale JSON → `public, max-age=3600`.
- [ ] `src/scripts/check-dist.mjs` fails the build when `index.html`, the manifest, `sw.js`, hashed JS/CSS,
      content JSON, locales, or the icon set are missing; it also asserts `sw.js` references a precache
      manifest.
- [ ] A post-deploy smoke step checks `index.html`, one hashed asset, and one `.webp` return `200`
      with the expected `Content-Type` and `Cache-Control`.
- [ ] A re-deploy of an older commit is the rollback path; no server-side state is involved.
- [ ] The README documents the required repository secrets/variables and the release flow.
- [ ] A custom domain is documented as CDN/Front Door work, not part of this feature.

## Tasks (ordered)

1. Enable the static website endpoint on the storage account; confirm `$web` and the default URL.
2. Add `src/scripts/check-dist.mjs` (Node, no deps): required files, precache manifest, no absolute
   `/assets/` URLs in `index.html`; it inspects `src/dist/`.
3. Add the pure helpers `contentTypeFor(path)` and `cacheControlFor(path)` under `src/scripts/lib/`,
   used by the deploy step and unit-tested.
4. Write `.github/workflows/ci.yml`: pnpm setup with cache, frozen install, typecheck, test,
   validate:content, build, check:dist.
5. Write `.github/workflows/deploy.yml`: `permissions: id-token: write, contents: read`;
   `azure/login` with OIDC; upload batches run with `working-directory: src`, where `-s dist` is the
   build output:
   `az storage blob upload-batch --auth-mode login -d '$web' -s dist --pattern "assets/*.js" --content-type "application/javascript" --content-cache-control "public, max-age=31536000, immutable"`
   and equivalent calls for CSS, images, JSON, and root files.
6. Upload `index.html`, `sw.js`, `registerSW.js`, and `manifest.webmanifest` last, with `no-cache`,
   so a client never sees a new shell before its assets exist.
7. Add the post-deploy smoke script (`curl -sI` checks) and fail the job on a bad header.
8. Document secrets/variables and the `develop` → `master` release in `README.md`.
9. Run a manual `workflow_dispatch` deploy to a non-production account first; then production.

## Tests

**Unit (Vitest):**

- `contentTypeFor` — `.html`, `.js`, `.css`, `.json`, `.webmanifest`, `.webp`, `.png`, `.svg`, `.woff2`,
  unknown extension → `application/octet-stream`.
- `cacheControlFor` — hashed assets immutable; art 7 days; root files no-cache; JSON 1 hour; unknown
  path defaults to no-cache (fail safe).

**Build/CI (real):**

- `check:dist` passes on a real build and fails when `sw.js` or `index.html` is removed.
- `ci.yml` is green on a pull request; `deploy.yml` is green on `workflow_dispatch`.

**Verification (manual, deployed URL):**

- Open the default endpoint; the app boots and the service worker registers.
- Deep-link `#/words?tab=wordbook` and reload: the app opens on that tab.
- `curl -I` shows `text/html` + `no-cache` for `index.html`, `application/javascript` + immutable for a
  hashed asset, and `image/webp` + 7 days for art.
- Install from the deployed URL on iPad Safari; go offline; cold-start.
- Deploy a second build; the installed app shows the update prompt.

## Non-goals

- No Azure CDN/Front Door or custom domain in this feature.
- No server-side rendering, API, or database.
- No blue/green slot swap (Blob static hosting has no slots); rollback is a re-deploy.
