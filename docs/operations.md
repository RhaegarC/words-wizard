# Operations

How to run Words Wizard in production: the Entra tenant, the Cloudflare
Worker and D1 database, the Pages app, the test database, and the operator-only
deletion procedure.

This document describes the Mission 2 topology. Entra ids and Worker vars are
public configuration; the only secrets are the test D1 credentials held by CI
and your shell.

**Verification:** the local commands in this document were run on 2026-10-30
(`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:dist`,
`pnpm worker:dev` with `GET /health` returning `{"ok":true,"contentVersion":"0.3.0"}`,
and `wrangler d1 migrations apply --local`). Feature 26 re-ran `pnpm typecheck`,
`pnpm test`, `pnpm build`, and `pnpm check:dist` on 2026-11-05; the host tier
boots the real Worker in `wrangler dev` with a local D1 and a local R2 under a
temporary `--persist-to` directory, and covers avatar upload, replacement,
removal, and public serving. Feature 31 re-ran those commands on 2026-11-06; its
host tier additionally covers word-image upload, replacement with the old object
gone, removal, rejection without a write, and public serving against the second
emulated bucket. Feature 28 re-ran those commands plus
`pnpm build:portal` on 2026-11-06; its host tier boots the same Worker with real
RS256 tokens and covers the admin staff boundary and snapshot. The custom
domains, production D1 database, R2 bucket, Workers Builds connection, both
Pages projects, Entra sign-in and app roles, and production `pnpm check:deploy`
are configured by the operator and were not run from the repository.

## Topology

| Piece | Value |
|---|---|
| App | `https://words.nioh.uk` — Cloudflare Pages, hash routes |
| Admin portal | `https://admin.words.nioh.uk` — a second Cloudflare Pages project, hash routes |
| API | `https://wordsapi.nioh.uk` — Cloudflare Worker, serving both front ends |
| Production D1 | `words-wizard`, binding `DB` |
| Test D1 | `words-wizard-test`, used only by the gated remote tier |
| Avatars | Cloudflare R2 `words-wizard-avatars`, binding `AVATARS`, public read at `https://avatars.nioh.uk` |
| Word images | Cloudflare R2 `words-wizard-images`, binding `WORD_IMAGES`, read through `<api>/v1/images/...` |
| Auth | Microsoft Entra ID, SPA redirect + PKCE, no client secret |
| Deploy | Cloudflare Git integration for both Pages and Workers Builds |
| CI | GitHub Actions: checks on PRs, gated remote D1 run, no deploy |

## Entra ID

1. Register a **single-page application** in the home tenant. Under **Supported account types**,
   choose **Accounts in any organizational directory and personal Microsoft accounts**
   (`AzureADandPersonalMicrosoftAccount`), matching the `common` authority both front ends use.
   Add all four redirect URIs under **Authentication → Single-page application**:
   - `https://words.nioh.uk/`
   - `http://localhost:8443/`
   - `https://admin.words.nioh.uk/`
   - `http://localhost:8444/`

   The child app and the admin portal share this one registration: same client
   id, same scope, same app roles.
2. Under **Expose an API**, set the Application ID URI to
   `api://<client-id>` and add an enabled delegated scope named
   `access_as_user` (`type: User`). The browser requests `openid`, `profile`,
   and that scope.
3. Under **Expose an API → Edit application manifest**, set
   `api.requestedAccessTokenVersion` to `2`. The Worker verifies the v2
   issuer (`…/v2.0`) and the client id as `aud`; a v1 token fails both.
4. Grant admin consent for the tenant so no user hits a consent prompt.
5. Put the tenant and client ids into the Worker vars and the Pages build
   environment. There is **no client secret**: the browser app is public and
   uses authorization code + PKCE.
6. Define the **app roles** `user`, `teacher`, and `admin` in the application
   manifest (`appRoles`, one entry each, `allowedMemberTypes` `User`), and
   assign the role to the account through **Enterprise applications →
   Users and groups**. The Worker maps the token's `roles` claim to the stored
   profile role (`admin` beats `teacher`, which beats `user`); a token without
   the claim — or with an unassigned role — stores `user`. The Worker also
   enforces the role on every `/v1/admin` route directly from the verified
   token: `teacher` and `admin` pass, a signed-in `user` gets `403 forbidden`,
   and an anonymous caller gets `401`. The admin portal shows Access Denied for
   a `user` but is not the enforcement point.
   To change a role, update the assignment in Entra. The next request carrying
   a fresh token syncs it; the old token keeps its old role until it expires
   (MSAL caches tokens for up to an hour).

**The supported account types and all six steps are load-bearing.** A
registration that signs users in but exposes no API on the configured
Application ID URI produces a valid redirect
and then fails the silent token request with `invalid_scope`; the page shows
the generic retry screen because the failure happens before any API call. That
symptom was reported as [bug 02](bugs/02-token-cache-after-login.md) and
required this registration to be corrected; check it before debugging the
client. Verify the registration with:

```bash
az ad app show --id <client-id> \
  --query '{uris:identifierUris, scopes:api.oauth2PermissionScopes, version:api.requestedAccessTokenVersion, spa:spa.redirectUris, roles:appRoles}'
```

`identifierUris` must contain `api://<client-id>`, the scope list must contain
`access_as_user` with `isEnabled: true`, `version` must be `2`, both redirect
URIs must be present, and `roles` must contain `user`, `teacher`, and `admin`.

The `roles` claim is only emitted for an app role that is defined **and
assigned**. A sign-in with no assignment is valid and stores role `user`, so a
missing assignment shows up as "everything is a user", not as a login failure.

The Worker validates the access token against the tenant's JWKS endpoint:

| Worker var | Value |
|---|---|
| `JWKS_URL` | `https://login.microsoftonline.com/common/discovery/v2.0/keys` |
| `TOKEN_ISSUER` | `https://login.microsoftonline.com/common/v2.0` |
| `EXPECTED_AUDIENCE` | the API application (client) id |
| `EXPECTED_TENANT` | the **home tenant** id — the only tenant whose app roles are trusted |
| `ALLOWED_ORIGINS` | `https://words.nioh.uk,http://localhost:8443,https://admin.words.nioh.uk,http://localhost:8444` |

The `common` issuer selects multi-tenant validation: a token from any Entra
tenant or personal Microsoft account is accepted when its `tid` is a GUID and
its issuer is the template with that `tid` in place of `common`. Roles are
honoured only from `EXPECTED_TENANT`, so a customer tenant's administrator
cannot assign itself the admin portal. A tenant-specific `JWKS_URL`, or a
non-GUID `EXPECTED_TENANT`, beside a `common` issuer is refused at startup.
To restrict sign-in to one tenant, name that tenant in `TOKEN_ISSUER` and
`JWKS_URL` instead.

`src/worker/wrangler.jsonc` holds these vars (the client id and home tenant are
placeholders until the operator replaces them). They are configuration, not
secrets.

## D1

### Production database

Create the database and copy its id into
`src/worker/wrangler.jsonc` at `d1_databases[0].database_id`:

```bash
cd src
pnpm exec wrangler d1 create words-wizard
pnpm exec wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc
pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
  --command "PRAGMA foreign_key_check;"
```

The Worker Builds deploy command applies migrations before every deploy, so a
forgotten manual apply cannot leave production behind:

```bash
wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && wrangler deploy --config worker/wrangler.jsonc
```

Migrations are **forward-only**. D1 has no down migrations; fix a bad migration
with a new one. Do not edit an applied migration.

### Test database

Create `words-wizard-test` the same way. Its id is never committed. The remote
tier reads only these variables:

- `WORDS_TEST_CLOUDFLARE_API_TOKEN`
- `WORDS_TEST_CLOUDFLARE_ACCOUNT_ID`
- `WORDS_TEST_D1_DATABASE_ID`

The test name and the `WORDS_TEST_` prefix are deliberate: a developer with a
production `CLOUDFLARE_API_TOKEN` in their shell must not be able to make
`pnpm test` migrate or write production. The remote tier skips visibly when the
three variables are absent.

## R2 and avatars

User photos live in an R2 bucket, not in D1 or the repository. The Worker
writes through the `AVATARS` binding and serves `GET /v1/avatars/*` from the
same bucket; a custom domain makes that route public read-only.

Create the bucket and attach its public domain:

```bash
cd src
pnpm exec wrangler r2 bucket create words-wizard-avatars
pnpm exec wrangler r2 bucket domain add words-wizard-avatars \
  --domain avatars.nioh.uk --zone-id <zone-id>
```

`--zone-id` is the Cloudflare zone that owns `nioh.uk`; copy it from the
dashboard's zone **Overview** page.

`src/worker/wrangler.jsonc` declares the binding (committed as configuration,
not a secret):

```jsonc
"r2_buckets": [
  { "binding": "AVATARS", "bucket_name": "words-wizard-avatars" },
  { "binding": "WORD_IMAGES", "bucket_name": "words-wizard-images" }
]
```

The page reads avatars from `VITE_AVATAR_BASE_URL` when it is set; otherwise it
builds the URL as `<VITE_API_BASE_URL>/v1/avatars`. Point that variable at
`https://avatars.nioh.uk` to bypass the Worker and let R2 serve the object
directly. Both addresses return the same bytes with
`Cache-Control: public, max-age=31536000, immutable`; object keys include a
random UUID, so a replaced photo gets a new URL and never needs revalidation.

Objects are written under `avatars/<oid>/<uuid>.<png|jpg|webp>`. An avatar
route whose `AVATARS` binding is missing fails with `config_missing` naming
`AVATARS`, and the public route checks the key shape before reading R2, so
`GET /v1/avatars/../…` or an arbitrary key answers `404`.

Local development and the host tier get an emulated bucket from
`wrangler dev --persist-to <dir>`; no credentials or real bucket are needed.

### Word images

Word pictures live in a **second** bucket, so the avatar bucket and its keys
stay untouched. Create it and confirm the `WORD_IMAGES` binding in
`src/worker/wrangler.jsonc`:

```bash
cd src
pnpm exec wrangler r2 bucket create words-wizard-images
```

No custom domain is needed: the Worker serves the bucket at
`GET /v1/images/*`, and the stored `words.image` URL is built from the request
origin, so the public API host is correct with no separate configuration.
Objects are written under `word-images/<wordId>/<uuid>.<png|jpg|webp>` by the
two staff routes; the public route validates the key shape before reading R2
and answers `404` for anything the upload route could not have written.
Images are capped at 2 MiB and stored with
`Cache-Control: public, max-age=31536000, immutable`; replacing one writes a
new key, so a stale cache never serves the old picture. A missing binding
fails the route with `config_missing` naming `WORD_IMAGES`.

When running `wrangler dev` locally, pass `--infer-origin-from-routes false`
if you upload images. Otherwise wrangler rewrites the request origin to the
configured production route, and the stored URL points at the live host
instead of the local server.

Deleting a word's image through the portal removes both the row value and the
object. Deleting rows by hand does **not**: R2 has no foreign key to D1, so
inspect `words.image`, derive the key after `/v1/images/`, and remove the
object explicitly if a manual rollback retires a picture.

## Workers Builds

Connect `RhaegarC/words-wizard` to the Worker:

| Setting | Value |
|---|---|
| Root directory | `src` |
| Install command | `pnpm install --frozen-lockfile` |
| Deploy command | `wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && wrangler deploy --config worker/wrangler.jsonc` |
| Production branch | `master` |
| Preview builds | off |

Workers Builds is pre-authenticated by Cloudflare. Do not add a Cloudflare
deploy token to GitHub. The only GitHub secrets are the test-only
`WORDS_TEST_*` values used by the optional remote job.

The Worker has the custom domain `wordsapi.nioh.uk` in
`src/worker/wrangler.jsonc`; deploy attaches it and Cloudflare issues the
certificate.

## Pages

Connect the Pages project to the same repository:

| Setting | Value |
|---|---|
| Project | `words-wizard` |
| Production branch | `master` |
| Root directory | `src` |
| Build command | `pnpm build` |
| Output directory | `dist` |
| Build environment | Node 22, pnpm 10 |
| Preview deployments | off |

Set these production environment variables:

- `VITE_ENTRA_CLIENT_ID`
- `VITE_ENTRA_TENANT_ID` — `common` (any Entra tenant and personal Microsoft
  accounts), or one tenant id to restrict sign-in
- `VITE_ENTRA_SCOPE` — `api://<client-id>/access_as_user`
- `VITE_API_BASE_URL` — `https://wordsapi.nioh.uk`
- `VITE_AVATAR_BASE_URL` — optional; `https://avatars.nioh.uk`. Leave it unset
  to serve avatars through the Worker at `<VITE_API_BASE_URL>/v1/avatars`.

Attach the custom domain `words.nioh.uk`. TLS is automatic. Previews stay off:
a preview URL would publish the dev dataset and its service worker.

### Admin portal

The portal is a **second Pages project** connected to the same repository. It
builds a different output directory from a different Vite config; neither app's
build contains the other.

| Setting | Value |
|---|---|
| Project | `words-wizard-admin` |
| Production branch | `master` |
| Root directory | `src` |
| Build command | `pnpm build:portal` |
| Output directory | `dist-portal` |
| Build environment | Node 22, pnpm 10 |
| Preview deployments | off |

It reads the same production environment variables as the child app
(`VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID=common`, `VITE_ENTRA_SCOPE`,
`VITE_API_BASE_URL`, optionally `VITE_AVATAR_BASE_URL`); a portal signed in
from a tenant other than the home one is stored as `user` and shows Access
Denied. Attach the custom domain `admin.words.nioh.uk`; sign-in requires the
redirect URI
`https://admin.words.nioh.uk/` on the shared registration. The portal never
stores data of its own — it reads the same D1 database through the Worker.

## CI

Pull requests to `develop` run `.github/workflows/ci.yml`:

1. `verify` — frozen install, `pnpm typecheck` (page, portal, tests, worker),
   `pnpm test`, `pnpm build`, `pnpm build:portal`, `pnpm check:dist`.
2. `remote-d1` — runs `pnpm test:db:remote` only when the three
   `WORDS_TEST_*` secrets exist; otherwise the job reports a visible skip.

There is no deploy workflow. Cloudflare's Git integration owns Pages and
Workers Builds, so a GitHub workflow never needs a Cloudflare deploy token.

## Health and logs

```bash
curl https://wordsapi.nioh.uk/health
curl -sD - -o /dev/null https://wordsapi.nioh.uk/v1/content
curl -sD - -o /dev/null -H 'Origin: https://words.nioh.uk' https://wordsapi.nioh.uk/v1/content
```

`/health` returns `{ "ok": true, "contentVersion": "..." }`. A `500` means the
database is missing or unmigrated (`content_meta` has no row). `/v1/content`
returns an `ETag` and `Cache-Control: public, max-age=300`; the CORS request
returns `Access-Control-Allow-Origin: https://words.nioh.uk`. An unlisted
origin receives no CORS header.

Post-deploy smoke check:

```bash
cd src
EXPECTED_CONTENT_VERSION=0.3.0 pnpm check:deploy
```

It checks the Pages document and a hashed asset, the Worker `/health`, the
content endpoint's version and ETag, the allowed CORS origin, and that an
unlisted origin gets no CORS header. It fails on a stale content version.

Wrangler logs:

```bash
cd src
pnpm exec wrangler tail --config worker/wrangler.jsonc
```

## Rollback

- **Worker:** Workers & Pages → `words-wizard-api` → Deployments → previous
  deployment → Rollback.
- **Pages:** Workers & Pages → `words-wizard` → Deployments → previous
  deployment → Rollback.
- **Database:** migrations are not rolled back. Write a forward migration and
  redeploy. A rollback that crosses a bad migration still needs that forward
  fix.

## Admin-only deletion

There is no delete endpoint and no reset control. Deletion is an operator
procedure, run against production only with explicit approval.

1. Confirm the request belongs to the account holder. The only user key is the
   Entra `oid`; never accept an email address or display name as the key.
2. Read the rows first. Capture `user_avatar_key` before deleting anything;
   the R2 object is outside D1 and is not covered by the cascade:

   ```bash
   cd src
   pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
     --command "SELECT u.oid, u.created_at, u.last_seen_at, p.user_avatar_key FROM users u LEFT JOIN profiles p ON p.user_id = u.oid WHERE u.oid = '<oid>';"
   ```

3. Delete the user row. Every user-owned table declares
   `ON DELETE cascade` to `users(oid)`, so this is the single cascade delete:

   ```bash
   pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
     --command "DELETE FROM users WHERE oid = '<oid>';"
   ```

4. Delete the recorded photo object, if there is one:

   ```bash
   pnpm exec wrangler r2 object delete \
     words-wizard-avatars/<user_avatar_key> --remote
   ```

   Only keys under `avatars/<oid>/` belong to this account. If the key is empty
   or the object was already replaced, list the account's prefix and delete any
   object still under it. Never delete a key taken from client input.

5. Confirm no orphan rows remain:

   ```bash
   pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
     --command "PRAGMA foreign_key_check;"
   ```

6. Record the date, the `oid`, the operator, and the approval in the operations
   log. Do not record the child's name, email address, photo key, or any other
   personal data in the log.

The cascade covers `profiles`, `progress`, `pack_introductions`, `metrics`,
`sessions`, `session_metrics`, and `metric_events`. Content tables are not
user-owned and are not touched. R2 has no foreign key to D1, which is why step 4
is a separate manual action.

## Secrets

- No secret is committed to the repository.
- Entra ids and Worker vars are public configuration.
- The only GitHub secrets are `WORDS_TEST_CLOUDFLARE_API_TOKEN`,
  `WORDS_TEST_CLOUDFLARE_ACCOUNT_ID`, and `WORDS_TEST_D1_DATABASE_ID`.
- The production Cloudflare credentials live in Cloudflare's Git integration,
  not in GitHub.
