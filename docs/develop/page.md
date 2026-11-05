# Deploy the page

The page is a static Vite build: source in `src/page`, output in `src/dist`. Cloudflare Pages
builds it from Git and serves it — no GitHub deployment workflow and no Cloudflare credential are
involved.

## One-time setup

Connect the Pages project to `RhaegarC/words-wizard` with these settings:

| Setting | Value |
|---|---|
| Project name | `words-wizard` |
| Production branch | `master` |
| Root directory | `src` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Build environment | Node 22, pnpm 10 |
| Preview deployments | Off |

Production URL: <https://words.nioh.uk>. Attach the custom domain under **Custom domains**; TLS
is automatic.

Set these in **Settings → Environment variables → Production** for the build:

- `VITE_ENTRA_CLIENT_ID` — the SPA application (client) id
- `VITE_ENTRA_TENANT_ID` — the Entra tenant id
- `VITE_ENTRA_SCOPE` — `api://<client-id>/access_as_user`
- `VITE_API_BASE_URL` — `https://wordsapi.nioh.uk`
- `VITE_AVATAR_BASE_URL` — optional; `https://avatars.nioh.uk`. Unset means
  `<VITE_API_BASE_URL>/v1/avatars`.

They are public configuration; there is no client secret. The matching Worker vars and the D1
database are in [worker.md](worker.md); the full topology is in [operations.md](../operations.md).

Do not add a deployment workflow or a `CLOUDFLARE_API_TOKEN` secret: the Git integration owns
deployment, and `src/page/test/scripts/deployment-config.test.ts` asserts it.

## Local development

### Configure

The SPA reads four required build-time variables from `src/.env`, plus one optional avatar
variable. Copy the example and fill it in with the Entra SPA registration:

```bash
cd src
cp .env.example .env
pnpm install
```

| Variable | Local value |
|---|---|
| `VITE_ENTRA_CLIENT_ID` | the SPA application (client) id |
| `VITE_ENTRA_TENANT_ID` | the Entra tenant id |
| `VITE_ENTRA_SCOPE` | `api://<client-id>/access_as_user` |
| `VITE_API_BASE_URL` | `http://localhost:8787` |
| `VITE_AVATAR_BASE_URL` | optional; unset means `http://localhost:8787/v1/avatars` |

`VITE_API_BASE_URL` points at the local Worker, never at production. The Entra registration must
list `http://localhost:8443/` as a redirect URI in addition to `https://words.nioh.uk/`, or
sign-in returns to an unregistered origin. It must also expose the
`api://<client-id>/access_as_user` scope and issue v2 access tokens; without those, sign-in
succeeds and the first boot fails with the generic retry screen. The full registration checklist
is in [operations.md → Entra ID](../operations.md#entra-id); the end-to-end sign-in flow and its
failure modes are in [login.md](login.md). `.env` is gitignored; these values are public
configuration, not secrets.

### Run against the local API

The page carries no content of its own: topics, packs, words, and progress all come from the
Worker and D1. Apply the migrations to the local database once, then run both processes in
separate terminals:

```bash
cd src
pnpm exec wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc
pnpm worker:dev   # terminal 1, http://localhost:8787
pnpm dev          # terminal 2, http://localhost:8443
```

The Worker reads its matching vars from `src/worker/wrangler.jsonc`; that side of the setup,
including how to re-apply migrations and reset the local database, is in
[worker.md](worker.md#local-development). The local D1 database persists under
`src/worker/.wrangler/state/` and is gitignored.

### Debug

- Both dev servers print their URL, rebuild errors, and request logs to their terminals. The Vite
  server serves the SPA from `src/page/`, and the service worker is not registered in development
  (`devOptions.enabled` is false), so a stale cache is never the cause of a dev-only bug. Test PWA
  caching with `pnpm build && pnpm preview` instead.
- In the browser DevTools, filter the **Network** tab on `localhost:8787` to see every API call.
  A CORS error means the Worker's `ALLOWED_ORIGINS` does not list `http://localhost:8443`; a `401`
  means the token is missing or rejected — see the auth checks in [worker.md](worker.md#debug).
- `#/__routes` is a dev-only route table. It seeds a server profile through the same provider the
  app uses and clears local state (the unsent outbox, device flags, and the legacy Mission 1
  database), but it cannot reset the D1 profile. Use the `wrangler d1 execute` commands in [worker.md](worker.md#debug) for that.
- The Mission 1 IndexedDB database `WordsWizardDB` is imported once on the first boot after
  sign-in and deleted only after a successful import or an explicit discard in Settings. If this
  browser holds the prototype's incompatible version-1 schema, the import reports it as unreadable
  and Settings can discard it; otherwise clear site data for `http://localhost:8443` once.
- `pnpm typecheck` covers the page, test, and worker projects; `pnpm test` runs the whole suite.
  Neither starts either dev server.

## Profile, avatar, and role

`GET /v1/me` carries `email`, `profile.role`, and `profile.userAvatarKey`. The page shows the
name and photo; role and email are server-owned and are never rendered.

**Top-right chip.** `AppShell` renders a display-only name chip inside `<main>`: the stored photo
when `userAvatarKey` is set, otherwise the display name's first code point. `src/page/avatar.ts`
owns both helpers — `avatarUrl(baseUrl, key)` returns `null` for a missing or malformed key, so a
bad value degrades to initials instead of a broken image, and `avatarInitials(name)` handles
CJK and empty names. The chip is not a link; the sidebar mini-profile remains the entry to
Settings.

**Settings photo.** The photo field accepts JPEG, PNG, or WebP. The browser preview comes from
`URL.createObjectURL` and is revoked when the file changes or the screen unmounts. Choosing a
new file replaces the pending preview; **Remove** marks the stored photo for deletion. Neither
action calls the API on its own.

**Save order.** A single save runs photo first, then name:

1. `uploadAvatar(file)` (multipart `POST /v1/me/avatar`) or `removeAvatar()`
   (`DELETE /v1/me/avatar`) when the photo changed;
2. `updateProfile(profile.id, patch)` for the display name;
3. `onProfileUpdated(...)` and `navigate("#/home")`.

If the photo step fails, the name is not sent and the screen stays put. If the name step fails
after a successful photo step, the photo change is already stored, so the message says the photo
saved and the name did not (`settings.photoSavedNameFailed`) rather than asking for the photo
again. A refused upload (for example a type or size rejected by the Worker) leaves the stored
profile untouched.

Multipart requests deliberately omit `Content-Type`: the browser sets the boundary. The API
client's one `401` refresh-retry applies to them like any other request.

## Deploy

1. Open a pull request against `develop`. CI runs `typecheck`, `test`, `build`, and
   `check:dist`.
2. Merge the pull request, then promote `develop` → `master`. The merge into `master` is the
   release action.
3. Pages rebuilds automatically. Watch it under **Workers & Pages → words-wizard → Deployments**.
4. Verify the deployed build and its API from the repository:

   ```bash
   cd src
   EXPECTED_CONTENT_VERSION=0.3.0 pnpm check:deploy
   ```

   It checks the Pages document and a hashed asset, the Worker `/health`, the content version
   and ETag, the allowed CORS origin, and that an unlisted origin gets no CORS header.

## Rollback

**Workers & Pages → words-wizard → Deployments** → pick the previous successful deployment →
**Rollback**. The page stores no learner data, so D1 is unaffected by an app rollback.
