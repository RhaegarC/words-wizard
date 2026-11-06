# Deploy the admin portal

The admin portal is a second static Vite build: source in `src/portal`, output in
`src/dist-portal`, served by its own Cloudflare Pages project at **`admin.words.nioh.uk`**. It talks
to the same Worker as the child app. Deployment is **two Pages projects and one Worker** — the
portal has no API of its own, no service worker, and no locale bundle.

Feature 28 ships the shell and the staff gate: sign-in, the Topics / Words / Archived navigation,
and a read-only content snapshot. Feature 29 adds the topic and pack write screens. Feature 30 adds
the word library, the word editor, and ordered pack membership; word images arrive in feature 31.

## One-time setup

Connect a second Pages project to `RhaegarC/words-wizard`:

| Setting | Value |
|---|---|
| Project name | `words-wizard-admin` |
| Production branch | `master` |
| Root directory | `src` |
| Build command | `pnpm build:portal` |
| Build output directory | `dist-portal` |
| Build environment | Node 22, pnpm 10 |
| Preview deployments | Off |

Attach the custom domain `admin.words.nioh.uk`; TLS is automatic. Previews stay off for the same
reason as the child app: an unreviewed build must not be publicly reachable.

The portal reads the **same build-time variables** as the child app, from the same `src/.env`:

- `VITE_ENTRA_CLIENT_ID`
- `VITE_ENTRA_TENANT_ID`
- `VITE_ENTRA_SCOPE` — `api://<client-id>/access_as_user`
- `VITE_API_BASE_URL` — `https://wordsapi.nioh.uk`
- `VITE_AVATAR_BASE_URL` — optional; the portal currently renders no avatars

There is no client secret. The existing Entra registration must also list the portal's redirect
URIs — `https://admin.words.nioh.uk/` and `http://localhost:8444/` — or sign-in returns to an
unregistered origin. The registration checklist is in
[operations.md → Entra ID](../operations.md#entra-id).

The portal origin must also be in the Worker's `ALLOWED_ORIGINS`
(`https://admin.words.nioh.uk`, `http://localhost:8444`); otherwise every API call fails CORS.

## Local development

Use the same `src/.env` as the child app. The portal inherits its redirect URI from the page origin
at runtime, so running on `http://localhost:8444` asks Entra for `http://localhost:8444/`.

Start the local Worker first, then the portal:

```bash
cd src
pnpm exec wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc
pnpm worker:dev   # terminal 1, http://localhost:8787
pnpm dev:portal   # terminal 2, http://localhost:8444
```

`pnpm dev` (the child app, 8443) and `pnpm dev:portal` (8444) can run at the same time against one
local Worker. The portal's Vite config is `src/vite.portal.config.ts`: root `portal/`, base `./`,
out dir `src/dist-portal`, port 8444 with `strictPort`.

### States

The shell draws one of four states; the API decides which, not the URL:

| State | Trigger |
|---|---|
| Loading | restoring the MSAL session, or fetching the access role and snapshot |
| Signed out | no Entra account; shows **Sign in with Microsoft**. An expired session says so first |
| Access Denied | signed in, but the token's role is `user`; shows the address and **Sign out** |
| Staff | `teacher` or `admin`; shows the shell and the selected screen |

Role precedence is `admin` > `teacher` > `user`, decoded from the access token's `roles` claim for
**UX only**. `GET /v1/admin/access` confirms it, and every admin route re-checks it server-side. A
token that clearly carries `user` skips the round trip and goes straight to Access Denied. A `403`
from the API also lands on Access Denied; a `401` clears the session and shows the expired message.

### Screens and routes

| Route | Screen |
|---|---|
| `#/topics` (default) | topics list, in curated order, with pack and word counts |
| `#/topics/new` | topic editor, create |
| `#/topics/:id` | topic editor, edit; the id is read-only and there is an archive danger zone |
| `#/topics/:id/packs` | packs in the topic, with move up/down that saves immediately |
| `#/topics/:id/packs/new` | pack editor, create |
| `#/packs/:id` | pack editor, edit; the topic is read-only |
| `#/packs/:id/contents` | pack contents: the ordered word draft, add/remove/move, **Save changes** |
| `#/words` | searchable word library: headword, Chinese meaning, phonetic, level, usage |
| `#/words/new` · `#/words/new?pack=:id` | word editor, create (optionally straight into a pack) |
| `#/words/:id` | word editor, edit; the id is read-only and there is no delete or archive control |
| `#/archived/topics` · `#/archived/packs` | archived rows with a Restore action |

An unknown fragment lands on Topics rather than a 404 screen; an unknown id shows a "does not
exist" panel. `#/archived` without a tab shows Topics.

Every write sends `If-Match` with the snapshot's `contentVersion`. A `409 conflict` loads the
latest snapshot and shows a banner: the teacher reviews the change and saves again. A `409
archived` means the row must be restored first. A `422` lists the validator's findings above the
form and keeps the entered values. A successful save refetches the snapshot, so counts and order
are never stale; editorial warnings are mentioned in the success notice.

**Words are shared and kept.** The library lists every word, including one in no pack (marked
*Not in any pack — hidden from children*) and archived history. Creating a word from a pack sends
`packId` with the create and lands back on that pack's contents; the placement is one atomic
batch. An edit changes every pack that holds the word, and the editor says so. There is no delete
or archive action anywhere in the portal.

**Pack contents is a draft.** The screen edits the whole ordered list locally. **Save changes**
sends the full list (`PUT /v1/admin/packs/:id/membership`); **Discard changes** restores the saved
order. While the draft differs, every in-app exit — sidebar, breadcrumb, back — asks before the
draft is lost, and a reload or close triggers the browser's own prompt. A duplicate or unknown id
is prevented by the picker, and a server `422` is shown above the list with the draft intact.

### Debug

- The portal reads `GET /v1/admin/access` and `GET /v1/admin/content` and writes to
  `/v1/admin/topics` and `/v1/admin/packs`. Filter the Network tab on `localhost:8787`; a write
  carries `If-Match` with the snapshot version.
- A CORS error means `ALLOWED_ORIGINS` does not list `http://localhost:8444`.
- A `401` means the token failed validation — check the Worker auth values in
  [worker.md](worker.md#debug).
- A `403` means the account's Entra app role is `user` (or unassigned). Change the assignment under
  **Enterprise applications → Users and groups**; the next fresh token carries the new role.
- The portal renders "The portal is not configured" with the missing key name when a required
  `VITE_*` value is absent.
- `pnpm test` includes the portal's unit tests under `src/portal/test/`; `pnpm build:portal` alone
  checks the production build.

## Tests

The portal's unit tier covers the parts that can be decided offline:

- `role.test.ts` — role precedence and malformed-token handling;
- `router.test.ts` — nested hash parsing, defaults, and href round-trips;
- `order.test.ts` — moving an id up or down, including the edge no-ops;
- `membership.test.ts` — appending without duplicates or mutation, removal, and order-sensitive
  dirtiness for the pack-contents draft;
- `api.test.ts` — the write client's verb, path, `If-Match`, and how 409/422 reach the screen,
  including `createWord`, `updateWord`, and `saveMembership`;
- `access.test.ts` — the four-state machine;
- `boundary.test.ts` — the portal imports only `page/auth/{config,msal,token,account,session}` from
  the child app, never a page provider, store, or API client; no child build can contain the
  portal; and the Vite config, scripts, gitignore, and CI wiring stay in place.

The staff gate itself is a Worker concern, covered by `src/worker/test/adminAuth.test.ts` and the
host tier in `src/worker/test/admin.test.ts`. Sign-in, Access Denied, and the shell are verified
manually in the browser, as for the child app.

## Build and deploy

1. Open a pull request against `develop`. CI runs `typecheck`, `test`, `build`, `build:portal`, and
   `check:dist`.
2. Merge the pull request, then promote `develop` → `master`. The merge into `master` is the release
   action.
3. Pages rebuilds **both** projects. Watch the portal under
   **Workers & Pages → words-wizard-admin → Deployments**.
4. Open <https://admin.words.nioh.uk> and sign in with a staff account. A `user` account must land
   on Access Denied.

## Rollback

**Workers & Pages → words-wizard-admin → Deployments** → previous successful deployment →
**Rollback**. The portal stores nothing; rolling it back affects no data.
