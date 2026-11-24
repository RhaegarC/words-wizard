# Bug 07 — The app cannot be installed to the home screen

> Severity: Normal · Status: In review — [PR #126](https://github.com/RhaegarC/words-wizard/pull/126)
> Reported: 2026-11-24 · Feature: 15 (PWA offline / install) and 16 (Cloudflare Pages)

## Summary

On a laptop and a phone, the browser does not offer **Install** / **Save to home screen** for the
production app. The manifest itself is valid — a fresh browser parses it without errors and reports
no installability errors — but the app is not installable on the reported devices.

The confirmed cause is the first defect below; the second is the same kind of latent defect and is
fixed alongside it.

1. **The service worker is registered only after a signed-in boot completes.** The installability
   check runs when the page loads, and the sign-in, loading and error screens never mount the one
   component that registers the worker. On the sign-in screen — where a user tries to install before
   signing in — the page therefore never becomes installable.
2. **The no-cache manifest is precached** by the service worker. Once a worker is active it serves
   the manifest it stored at install time, not the current one. The icon rename is exactly the kind
   of change this hides: a pinned manifest can keep naming icon URLs that no longer resolve, and
   Pages answers those paths with the SPA document (`200 text/html`), which is not a valid image.

## Environment

- Production page at `https://words.nioh.uk/`
- The manifest served at `https://words.nioh.uk/manifest.webmanifest`, the worker at `/sw.js`
- Chrome/Edge on laptop; Chrome/Safari on phone
- App registration with icons renamed to `icon-192-v2.png`, `icon-512-v2.png`,
  `maskable-512-v2.png`

## Steps to reproduce

1. Open the production app in a fresh browser profile and stay on the sign-in screen.
2. Use the browser's install action, or try to install before signing in.
3. Repeat after signing in: the worker registers and install becomes available, but only then.

## Expected

The browser offers install on the first page load, and the app's install card can open the native
prompt. The installed app uses the current manifest and icons.

## Actual

No install prompt is offered. The app's install screen falls back to manual browser steps, and even
the browser menu does not offer install. A fresh profile parses the manifest with no errors, but
`navigator.serviceWorker.getRegistrations()` is empty on the sign-in screen — the browser's install
criteria also require a registered worker, a rule the CDP installability API does not report.

## Root cause

1. **Late worker registration.** `UpdateProvider` calls the only `useRegisterSW` hook, and it is
   rendered only in `App`'s final signed-in return. `App` returns early for signed-out, config
   error, auth error and boot-loading states. The browser evaluates installability on page load; on
   those screens no worker is registered, so the page never becomes installable in time.
2. **Manifest pinned by the worker.** `vite.config.ts` includes `webmanifest` in the Workbox
   `globPatterns`, so `manifest.webmanifest` is precached and served by the active worker. The
   `_headers` rule says the manifest is `no-cache`, and the worker overrides that: a manifest
   change is invisible until the worker itself updates and activates. That is how the icon rename
   could leave a client on a manifest pointing at icon URLs the server no longer serves as images.
   Removing the manifest from the precache makes the `no-cache` contract real.

## Fix

- Mount `UpdateProvider` at the application root in `main.tsx`, outside `App`'s early returns, so
  the worker registers on every page load, including sign-in and boot. Remove the provider from
  `App`.
- Remove `webmanifest` from the Workbox precache patterns. The manifest stays a network resource
  with `Cache-Control: no-cache`; icons remain precached.
- New visitors are fixed by the deploy itself. A client already controlled by the old worker keeps
  receiving the precached old application bundle, so it needs one worker update — accept the update
  notice on Home or the Profile page, or clear site data — before the new registration and the
  unpinned manifest take effect.

## Regression tests

- `src/page/test/pwa/registration.test.ts` (source assertion) — `main.tsx` wraps the app in
  `UpdateProvider`, `App.tsx` does not, and the Vite PWA precache glob does not include
  `webmanifest` while it still includes `icons/*.png`.

## Verification

- **Before the fix**, headless Edge (CDP) against production, fresh profile held on the sign-in
  screen for 8 s: `navigator.serviceWorker.getRegistrations()` returned `[]`; manifest and
  installability errors were `[]`; `beforeinstallprompt` reached the page and was consumed by the
  app's capture listener. No worker on the screen where install is attempted.
- **After the fix**, the same audit against the local production build: one active registration at
  `http://localhost:8443/sw.js` on the sign-in screen, manifest and installability errors `[]`,
  install prompt captured.
- `pnpm exec vitest run page/test shared/test portal/test` — 69 files, 836 tests passed.
- `pnpm typecheck`, `pnpm build`, `pnpm check:dist` — clean. The built `dist/sw.js` contains zero
  `manifest.webmanifest` entries and precaches the four `icons/*-v2.png` files.
- Full suite: 1171 passed, 10 skipped, 6 timed out — all six in the `wrangler`-backed database and
  host tiers, which this change does not touch. Earlier full runs today passed that tier, and
  `wrangler d1 migrations apply` succeeded against a fresh local directory while investigating, so
  the timeouts are machine load, not a schema failure.
- Existing clients: the old worker keeps serving the precached application bundle until it is
  updated, so they need to accept the update notice once (Home or Profile) to receive the fix.
