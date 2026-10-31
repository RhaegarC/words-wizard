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
and `wrangler d1 migrations apply --local`). The custom domains, production D1
database, Workers Builds connection, Entra sign-in, and production
`pnpm check:deploy` are configured by the operator and were not run from the
repository.

## Topology

| Piece | Value |
|---|---|
| App | `https://words.nioh.uk` — Cloudflare Pages, hash routes |
| API | `https://wordsapi.nioh.uk` — Cloudflare Worker |
| Production D1 | `words-wizard`, binding `DB` |
| Test D1 | `words-wizard-test`, used only by the gated remote tier |
| Auth | Microsoft Entra ID, SPA redirect + PKCE, no client secret |
| Deploy | Cloudflare Git integration for both Pages and Workers Builds |
| CI | GitHub Actions: checks on PRs, gated remote D1 run, no deploy |

## Entra ID

1. Register a **single-page application** in the tenant. Add both redirect
   URIs:
   - `https://words.nioh.uk/`
   - `http://localhost:8443/`
2. Expose an API scope named `access_as_user`. The browser requests
   `openid`, `profile`, and that scope.
3. Put the tenant and client ids into the Worker vars and the Pages build
   environment. There is **no client secret**: the browser app is public and
   uses authorization code + PKCE.

The Worker validates the access token against the tenant's JWKS endpoint:

| Worker var | Value |
|---|---|
| `JWKS_URL` | `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys` |
| `TOKEN_ISSUER` | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| `EXPECTED_AUDIENCE` | the API application (client) id |
| `EXPECTED_TENANT` | the tenant id |
| `ALLOWED_ORIGINS` | `https://words.nioh.uk,http://localhost:8443` |

`src/worker/wrangler.jsonc` holds these vars (the committed values are
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
- `VITE_ENTRA_TENANT_ID`
- `VITE_ENTRA_SCOPE` — `api://<client-id>/access_as_user`
- `VITE_API_BASE_URL` — `https://wordsapi.nioh.uk`

Attach the custom domain `words.nioh.uk`. TLS is automatic. Previews stay off:
a preview URL would publish the dev dataset and its service worker.

## CI

Pull requests to `develop` run `.github/workflows/ci.yml`:

1. `verify` — frozen install, `pnpm typecheck` (page, tests, worker),
   `pnpm test`, `pnpm build`, `pnpm check:dist`.
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
2. Read the rows first:

   ```bash
   cd src
   pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
     --command "SELECT oid, created_at, last_seen_at FROM users WHERE oid = '<oid>';"
   ```

3. Delete the user row. Every user-owned table declares
   `ON DELETE cascade` to `users(oid)`, so this is the single cascade delete:

   ```bash
   pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
     --command "DELETE FROM users WHERE oid = '<oid>';"
   ```

4. Confirm no orphan rows remain:

   ```bash
   pnpm exec wrangler d1 execute DB --remote --config worker/wrangler.jsonc \
     --command "PRAGMA foreign_key_check;"
   ```

5. Record the date, the `oid`, the operator, and the approval in the operations
   log. Do not record the child's name or any other personal data in the log.

The cascade covers `profiles`, `progress`, `pack_introductions`, `metrics`,
`sessions`, `session_metrics`, and `metric_events`. Content tables are not
user-owned and are not touched.

## Secrets

- No secret is committed to the repository.
- Entra ids and Worker vars are public configuration.
- The only GitHub secrets are `WORDS_TEST_CLOUDFLARE_API_TOKEN`,
  `WORDS_TEST_CLOUDFLARE_ACCOUNT_ID`, and `WORDS_TEST_D1_DATABASE_ID`.
- The production Cloudflare credentials live in Cloudflare's Git integration,
  not in GitHub.
