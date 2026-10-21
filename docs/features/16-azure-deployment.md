# Feature 16 — Azure Deployment & CI

> Priority: Must · Mission 1 · **Status: Not started**
> Depends on: 01, 04, 15

## Summary

Publish the static build to **Azure Static Web Apps** from GitHub Actions. Static Web Apps serves
the files, infers MIME types, and applies the navigation fallback and cache headers declared in
`staticwebapp.config.json`. There is no server, no API, and no runtime secret: hash routing means
every deep link is an `index.html` load, and all data is on the device.

Deployment runs from `master`. Feature PRs still target `develop`; promoting `develop` → `master` is
the release action. Pull-request preview environments are deliberately **not** enabled — a preview
URL would serve the dev dataset and its service worker before feature 17 lands.

## User story

As a **developer**, merging a release builds, tests, validates, and publishes the app without a
manual upload. As a **parent**, the installed app updates from the same URL without reinstalling.

## Acceptance criteria

- [ ] An Azure Static Web App (Free plan) is linked to the GitHub repository; its production
      environment tracks `master` and is served over HTTPS at the default
      `https://<name>.azurestaticapps.net` URL.
- [ ] `pnpm build` produces `src/dist/` with relative asset URLs (`base: "./"`), so the build also
      works if served from a sub-path.
- [ ] `src/public/staticwebapp.config.json` is copied into `src/dist/staticwebapp.config.json` and
      declares:
      - `navigationFallback` rewriting unknown paths to `/index.html`, excluding hashed assets and
        asset-like extensions so a missing file still returns 404;
      - `Cache-Control` per class: `assets/*` → `public, max-age=31536000, immutable`; icons and
        artwork → `public, max-age=604800`; content and locale JSON → `public, max-age=3600`;
        `/`, `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest` → `no-cache`.
- [ ] `.github/workflows/ci.yml` runs on pull requests to `develop`: install (pnpm, frozen lockfile),
      `typecheck`, `test`, `validate:content`, `build`, and `check:dist`. All pnpm steps run with
      `working-directory: src`; the package manifest lives there.
- [ ] `.github/workflows/deploy.yml` runs on push to `master` and on `workflow_dispatch`: the same
      checks, then uploads the **prebuilt** `src/dist/` with `Azure/static-web-apps-deploy@v1`
      (`action: upload`, `app_location: "src/dist"`, `skip_app_build: true`, `api_location: ""`) so
      the action does not re-run a build with a different package manager.
- [ ] The deployment token comes from the `AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret. No
      credential is committed and no storage key or connection string is used.
- [ ] `src/scripts/check-dist.mjs` fails the build when `index.html`, the manifest, `sw.js`, hashed
      JS/CSS, content JSON, locales, the icon set, or `staticwebapp.config.json` are missing. It also
      asserts `sw.js` references a precache manifest, the config parses and contains a
      `navigationFallback` rewrite to `/index.html`, and `index.html` carries no absolute
      `/assets/` URLs.
- [ ] A post-deploy smoke step fetches `/`, one hashed asset, and one `.webp` and asserts `200` with
      the expected `Content-Type` and `Cache-Control`.
- [ ] Re-running the deployment workflow on an older commit is the rollback path; the app holds no
      server-side state.
- [ ] The README documents the repository secret, the default URL, and the `develop` → `master`
      release flow.
- [ ] Custom domains are documented as a Static Web Apps resource setting (free managed
      certificate), not part of this feature.

## Tasks (ordered)

1. Create the Static Web App (Free plan) linked to `RhaegarC/words-wizard`; record the default
   `*.azurestaticapps.net` URL and confirm the production environment tracks `master`.
2. Copy the deployment token into the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Add `src/public/staticwebapp.config.json`, specific routes first:
   ```json
   {
     "navigationFallback": {
       "rewrite": "/index.html",
       "exclude": ["/assets/*", "/*.{css,js,png,svg,webp,json,webmanifest,ico,txt}"]
     },
     "routes": [
       { "route": "/assets/*", "headers": { "Cache-Control": "public, max-age=31536000, immutable" } },
       { "route": "/content/art/*", "headers": { "Cache-Control": "public, max-age=604800" } },
       { "route": "/icons/*", "headers": { "Cache-Control": "public, max-age=604800" } },
       { "route": "/content/*", "headers": { "Cache-Control": "public, max-age=3600" } },
       { "route": "/locales/*", "headers": { "Cache-Control": "public, max-age=3600" } },
       { "route": "/", "headers": { "Cache-Control": "no-cache" } },
       { "route": "/index.html", "headers": { "Cache-Control": "no-cache" } },
       { "route": "/sw.js", "headers": { "Cache-Control": "no-cache" } },
       { "route": "/registerSW.js", "headers": { "Cache-Control": "no-cache" } },
       { "route": "/manifest.webmanifest", "headers": { "Cache-Control": "no-cache" } }
     ]
   }
   ```
   Static Web Apps infers MIME types itself, so there is no per-extension upload step.
4. Add `src/scripts/check-dist.mjs` (Node, no deps): required files, precache manifest, config
   shape, no absolute `/assets/` URLs in `index.html`; it inspects `src/dist/`.
5. Add `src/scripts/check-deploy.mjs` (Node, no deps, `fetch`): request the deployed URL with
   `HEAD`/`GET`, assert status, `content-type`, and `cache-control` for `/`, a hashed asset, and a
   `.webp`.
6. Write `.github/workflows/ci.yml`: pnpm setup with cache, frozen install, typecheck, test,
   `validate:content`, build, `check:dist`.
7. Write `.github/workflows/deploy.yml`: `permissions: contents: read`; the same checks, then the
   upload step with the deployment token. Do not add a `pull_request` trigger.
8. Run a manual `workflow_dispatch` deploy of a known commit; inspect the deployed headers.
9. Document the secret, URL, release flow, and rollback in `README.md`.

## Tests

**Unit (Vitest, always offline):**

- `staticwebapp.config.test.ts` reads `src/public/staticwebapp.config.json` and asserts the
  navigation fallback rewrites to `/index.html`, excludes assets, and that every cache class in the
  acceptance criteria has a matching route rule. This is a file-property test: it goes red when the
  rule is deleted or a route is reordered so a broader rule shadows a narrower one.

**Build/CI (real):**

- `check:dist` passes on a real build and fails when `sw.js`, `index.html`, or
  `staticwebapp.config.json` is removed.
- `ci.yml` is green on a pull request; `deploy.yml` is green on `workflow_dispatch`.

**Verification (manual, deployed URL):**

- Open the default endpoint; the app boots and the service worker registers.
- Deep-link `#/words?tab=wordbook` and reload: the app opens on that tab.
- `curl -I` shows `text/html` + `no-cache` for `/` and `/index.html`,
  `application/javascript` + `immutable` for a hashed asset, and `image/webp` + 7 days for art.
- Install from the deployed URL on iPad Safari; go offline; cold-start.
- Deploy a second build; the installed app shows the update prompt.

## Non-goals

- No custom domain or DNS in this feature; Static Web Apps manages custom domains natively when a
  domain exists.
- No pull-request preview environments — they would publish the dev dataset and its service worker
  before feature 17.
- No Azure CDN, Front Door, server-side rendering, API, database, or authentication.
- No blue/green slot swap; rollback is re-running the deployment workflow on an older commit.
