# Feature 15 — PWA Install, Offline & Updates

> Priority: Must · Mission 1 · **Status: Done — merged in PR #33**
> Depends on: 02, 05, 14

## Summary

The installed PWA is the primary product. This feature makes the app installable, makes it work
fully offline after the first load, and makes updates **visible**: a new service worker waits and the
app asks "A new pack is ready!" instead of silently swapping content under the child.

Installation is a strong, repeated prompt — not a gate. Practice is never blocked.

## User story

As a **child**, I add the app to my Home Screen and it works on the bus with no signal. As a
**parent**, I am told why adding to the Home Screen matters and I can update the app without losing
progress.

## Acceptance criteria

- [x] `public/manifest.webmanifest` has the product name (English + Chinese short name), `start_url:
      "./"`, `scope: "./"`, `display: "standalone"`, theme/background colors, and 192/512 PNG icons
      plus a maskable icon.
- [x] A service worker precaches the app shell, content JSON, `locales/*.json`, avatars, and **all
      artwork** at install; after the first successful load the app makes no network request to
      render any screen.
- [x] The service worker is generated with Workbox (`vite-plugin-pwa`, `registerType: "prompt"`),
      uses a revisioned precache, and cleans old caches on activation.
- [x] A new service worker **never** calls `skipWaiting` on its own. The app receives
      `onNeedRefresh`, shows "A new pack is ready!" with **Refresh** and **Later**, and calls
      `updateServiceWorker(true)` only on Refresh.
- [x] Navigation requests resolve to `index.html` so a hash deep link works offline.
- [x] Install detection: `matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true`; the result is recorded in `device.installed` at boot.
- [x] The install prompt appears after character creation and on each boot until installed; it is
      dismissible once per **session** (in-memory, not persisted) and reappears next session.
- [x] Platform-specific steps are shown:
      iPad Safari — Share → Add to Home Screen; Chromium/Edge — the native
      `beforeinstallprompt` where available, otherwise menu → Apps → Install this site.
- [x] Prompt copy explains, in one sentence, that a Safari **tab** can lose data after a week while a
      Home Screen app does not. It never threatens or blocks.
- [x] `navigator.storage.persist()` runs on first launch (feature 05); its result is shown in
      diagnostics and used by the install prompt copy when persistence was denied.
- [ ] The app remains fully functional with no network after first load, including a cold start.
- [x] Updates preserve IndexedDB data; there is no migration on `skipWaiting`.
- [ ] Cache size is measured and stays within the 10–15 MB target for 315 images plus the shell.

## Tasks (ordered)

1. Add `vite-plugin-pwa` and configure `generateSW`: precache globs for shell, JSON, locales, and
   `art/**/*.webp`; `navigateFallback: "index.html"`; `registerType: "prompt"`;
   `cleanupOutdatedCaches: true`; `maximumFileSizeToCacheInBytes` above the largest asset.
2. Replace the prototype `public/sw.js` (the naive cache-first worker with `skipWaiting`) so it does
   not shadow the generated worker.
3. Wire `virtual:pwa-register` in `src/main.tsx`; expose `needRefresh` and `update()` through a small
   `useServiceWorkerUpdate()` hook.
4. Build the update prompt component and mount it on Home (and Settings).
5. Implement `detectInstallContext()` — pure: standalone, iOS, Chromium, browser tab.
6. Implement `installStepsFor(context)` — pure: returns the ordered steps and copy keys.
7. Build the Install Prompt screen/card with platform steps, dismiss, and "continue in browser".
8. Record `device.installed` at boot; increment `profileAbsentAtBoot` only when installed (feature 05
   provides the counter; this feature supplies the context).
9. Add `beforeinstallprompt` capture for Chromium and call `prompt()` from the install button.
10. Verify offline cold start, update flow, and cache size on a real iPad.
11. Add the update status and install status slots to Settings (feature 14).

## Tests

**Unit (Vitest):**

- `detectInstallContext` — standalone iOS → installed; Safari tab on iOS → `ios-browser`; Chromium
  with `beforeinstallprompt` available → `chromium-installable`; Chromium without it →
  `chromium-manual`; desktop browser tab → `browser`.
- `installStepsFor` — exactly the documented steps per platform, in order; no step for installed.
- Prompt visibility — hidden when installed; shown after creation; dismissal is session-scoped and
  does not write to the device table.
- Update state machine — `needRefresh` shows the prompt; Later keeps the old worker; Refresh calls
  `update()` once.
- Precaching is **not** unit-tested (a browser cache cannot be faked without asserting about the
  fake); it is covered by the verification below.

**Verification (manual, real browser — this is the tier for service-worker behaviour):**

- First load online, then DevTools → Offline → reload: Home, a full session, My Words, and all images
  work; no failed requests.
- iPad Safari: add to Home Screen, enable Airplane Mode, cold-start the app, complete a session.
- Change `contentVersion` and redeploy: the app shows "A new pack is ready!"; Later keeps the old
  content; Refresh shows the new content and progress is intact.
- Confirm the old cache is gone after activation (`caches.keys()`).
- `navigator.storage.estimate()` shows the expected 10–15 MB.
- Install prompt shows the right steps on iPad Safari and Edge, and never blocks Practice.

## Non-goals

- No push notifications, background sync, or periodic background refresh.
- No native packaging.
- No runtime content or image fetching.
