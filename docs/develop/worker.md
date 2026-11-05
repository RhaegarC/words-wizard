# Deploy the Worker

The API is a Hono Worker in `src/worker`, with a D1 binding and the custom domain
`wordsapi.nioh.uk`. Cloudflare Workers Builds builds and deploys it from Git — no GitHub
deployment workflow and no Cloudflare deploy token are involved.

## Local development

### Configure

The Worker reads its vars from `src/worker/wrangler.jsonc`. Replace the `REPLACE_WITH_*`
placeholders with the same tenant and client the page uses, or local sign-in cannot be validated:

| Var | Value |
|---|---|
| `JWKS_URL` | `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys` |
| `TOKEN_ISSUER` | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| `EXPECTED_AUDIENCE` | the API application (client) id |
| `EXPECTED_TENANT` | the tenant id |
| `ALLOWED_ORIGINS` | must include `http://localhost:8443` |

The `d1_databases[0].database_id` placeholder does not matter locally: `--local` never contacts a
remote database, and the id is only used before a deploy. The `r2_buckets` binding `AVATARS` is
emulated the same way: uploads land in the local persistence directory and need no credentials. There is no local secret, so no
`.dev.vars` file is needed. To try an override without editing the file, pass it on the command
line:

```bash
pnpm exec wrangler dev --config worker/wrangler.jsonc --var EXPECTED_TENANT:<tenant-id>
```

### Apply migrations to the local database

Local D1 starts empty. Apply the committed migration set before the first run and after adding a
migration:

```bash
cd src
pnpm exec wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc
```

- Only unapplied migrations run, so the command is safe to repeat.
- `wrangler d1 migrations list DB --local --config worker/wrangler.jsonc` shows what is pending.
- The database lives under `src/worker/.wrangler/state/` (gitignored) and survives a restart.
- To start from an empty database, stop the dev server, delete `src/worker/.wrangler/state/`, and
  apply again. This also discards seeded content and any local profiles; the committed migrations
  recreate the content, not the users.

Apply migrations with the dev server stopped. `wrangler dev` opens the local database at startup;
a new table is normally visible on the next request, but a schema change is easiest to reason
about after a restart.

### Run

```bash
cd src
pnpm worker:dev    # http://localhost:8787
```

`pnpm worker:deploy` targets production — do not run it to test a local change.

### Avatars

Three routes touch R2. All of them require authentication except the public reader:

| Route | Behaviour |
|---|---|
| `POST /v1/me/avatar` | multipart `file`, ≤2 MiB, JPEG/PNG/WebP by magic bytes; stores `avatars/<oid>/<uuid>.<ext>`, replaces and deletes the previous object, returns `{ key }` |
| `DELETE /v1/me/avatar` | idempotent `204`; clears the stored key and deletes the object |
| `GET /v1/avatars/*` | public, no auth; serves the object with `Cache-Control: public, max-age=31536000, immutable` |

`src/worker/avatar.ts` owns the constants and pure checks: `detectImageType` reads the file's
signature rather than trusting `Content-Type`, `avatarKey` builds the storage path, and
`isAvatarKey` rejects anything outside `avatars/<one-segment>/<one-segment>.<ext>`. The public
route validates the key **before** calling R2, so a traversal attempt or an arbitrary key is a
`404` and never a bucket read.

`src/worker/r2.ts` declares the minimal structural interface (`get`, `put`, `delete`) so the
Worker does not depend on `@cloudflare/workers-types`. `requireAvatars(env)` in `config.ts`
throws `ConfigError("AVATARS")` — the same `config_missing` 500 as a missing `DB` — if the
binding is absent.

The object is written **before** the profile row is updated. If the row update fails, the new
object is deleted again, so a failed request leaves neither a stale key nor an orphan.

Local uploads and the public reader work against the emulated bucket; `pnpm test` uses its own
temporary persistence directory.

### Debug

- The dev server logs each request and any stack trace to its terminal.
- Probe the routes directly:

  ```bash
  curl http://localhost:8787/health
  curl -sD - -o /dev/null http://localhost:8787/v1/content
  curl -sD - -o /dev/null -H 'Origin: http://localhost:8443' http://localhost:8787/v1/content
  ```

  `/health` returns `{"ok":true,"contentVersion":"..."}`. A `500` means the local database is not
  migrated or `content_meta` is empty — apply migrations. The CORS request must return
  `Access-Control-Allow-Origin: http://localhost:8443`.

- Inspect the local database with `--local` and the same config:

  ```bash
  pnpm exec wrangler d1 execute DB --local --config worker/wrangler.jsonc \
    --command "SELECT * FROM content_meta;"
  pnpm exec wrangler d1 execute DB --local --config worker/wrangler.jsonc \
    --command "SELECT COUNT(*) FROM words;"
  ```

  Use `--remote` only when you mean production, deliberately.

- A `401` from a route the page calls means the access token failed validation. Check that
  `EXPECTED_AUDIENCE` is the **API** client id (not the SPA client id), that `EXPECTED_TENANT` and
  `TOKEN_ISSUER` name the same tenant, and that `JWKS_URL` is reachable. The SPA must request
  `VITE_ENTRA_SCOPE` for that same API client id. A browser-side CORS failure instead means
  `ALLOWED_ORIGINS` does not list the page origin.

- `pnpm worker:typecheck` type-checks the Worker alone. `pnpm test` runs the Worker tests against
  their own temporary D1 directories and never touches this local database.

## Before the first build

1. Create the production database and note the returned id:

   ```bash
   cd src
   pnpm exec wrangler d1 create words-wizard
   ```

2. Put the id into `src/worker/wrangler.jsonc` at `d1_databases[0].database_id`. The committed
   value is a placeholder, and a deploy against it fails.
3. Replace the `REPLACE_WITH_*` Entra values in the same file. The tenant id, API audience
   (`EXPECTED_AUDIENCE`), issuer, and JWKS URL are the values in [operations.md](../operations.md).
4. Create the avatar bucket and attach its public domain. The `AVATARS` binding already names the
   bucket; the domain is optional if the page reads avatars through the Worker:

   ```bash
   pnpm exec wrangler r2 bucket create words-wizard-avatars
   pnpm exec wrangler r2 bucket domain add words-wizard-avatars \
     --domain avatars.nioh.uk --zone-id <zone-id>
   ```

   [operations.md → R2 and avatars](../operations.md#r2-and-avatars) records the full procedure.
5. Confirm `nioh.uk` is an active zone in the account: the `routes` entry attaches
   `wordsapi.nioh.uk` at deploy time.

Optionally create `words-wizard-test` the same way for the gated remote test tier. Its id is read
from `WORDS_TEST_D1_DATABASE_ID` only and is never committed.

## One-time setup

Connect the Worker to `RhaegarC/words-wizard` with these settings:

| Setting | Value |
|---|---|
| Root directory | `src` |
| Install command | `pnpm install --frozen-lockfile` |
| Deploy command | `wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && wrangler deploy --config worker/wrangler.jsonc` |
| Production branch | `master` |
| Preview builds | Off |

`--config worker/wrangler.jsonc` is required. The config lives under `worker/`, and `main`,
`migrations_dir`, and the D1 binding all resolve relative to it.

The deploy command applies migrations before every deploy; after the first build it is a no-op. In
a non-interactive build the confirmation prompt is skipped. Never edit an applied migration — add a
new one and bump `content_version`.

Workers Builds is pre-authenticated by Cloudflare. Do not add a GitHub secret for it.

## Deploy

1. Open a pull request against `develop`, merge it, then promote `develop` → `master`.
2. The merge into `master` triggers a build: install → apply D1 migrations → `wrangler deploy`.
3. Verify with the post-deploy check, which covers Pages and the Worker together:

   ```bash
   cd src
   EXPECTED_CONTENT_VERSION=0.3.0 pnpm check:deploy
   ```

   It also checks the Worker `/health`, the content version and ETag, and both the allowed and
   an unlisted CORS origin. For the raw responses:

   ```bash
   curl https://wordsapi.nioh.uk/health
   curl -sD - -o /dev/null https://wordsapi.nioh.uk/v1/content
   curl -sD - -o /dev/null -H 'Origin: https://words.nioh.uk' https://wordsapi.nioh.uk/v1/content
   ```

   The first returns `{"ok":true,"contentVersion":"0.3.0"}`. The second returns `200` with an
   `ETag` and `Cache-Control: public, max-age=300`. The third also returns
   `Access-Control-Allow-Origin: https://words.nioh.uk`.

   A `500` on `/health` means the database is missing or unmigrated (`content_meta` has no row).

Until the authored vocabulary seed lands (feature 17), `/v1/content` serves the avatars and an
empty vocabulary. That is expected, not a deployment failure.

## Rollback

**Workers & Pages → words-wizard-api → Deployments** → previous deployment → **Rollback**.
Migrations are not rolled back; write a forward migration instead.
