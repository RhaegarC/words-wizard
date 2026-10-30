# Deploy the Worker

The API is a Hono Worker in `src/worker`, with a D1 binding and the custom domain
`wordsapi.nioh.uk`. Cloudflare Workers Builds builds and deploys it from Git — no GitHub
deployment workflow and no Cloudflare deploy token are involved.

## Before the first build

1. Create the production database and note the returned id:

   ```bash
   cd src
   pnpm exec wrangler d1 create words-wizard
   ```

2. Put the id into `src/worker/wrangler.jsonc` at `d1_databases[0].database_id`. The committed
   value is a placeholder, and a deploy against it fails.
3. Replace the `REPLACE_WITH_*` Entra values in the same file. Feature 25 records the real tenant
   id, client id, issuer, and JWKS URL.
4. Confirm `nioh.uk` is an active zone in the account: the `routes` entry attaches
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
3. Verify:

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
