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
| `ALLOWED_ORIGINS` | must include `http://localhost:8443` and `http://localhost:8444` |

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

### Legacy import

`POST /v1/me/import` merges a Mission 1 device export into the token owner's rows.

| Aspect | Behaviour |
|---|---|
| Auth | required; rows are written for the token's `oid` only |
| Body | `{ profile, progress, metrics }`, camelCase, **256 KiB** cap (other routes keep 64 KiB) |
| Success | `{ progress: { imported, skipped }, metrics: { imported, skipped }, profileUpdated, me }` — `me` replaces the client snapshot in one round trip |
| Errors | `401` anonymous; `404 profile_not_found` before character creation; `422 validation_failed` for a malformed or oversized payload, with nothing written |
| Methods | `ROUTES` declares `POST` only, so another method is `405` with `Allow: POST` |

The payload validator lives in `src/shared/legacyImport.ts` (`parseLegacyImport`). It rejects
unknown fields, identity fields, duplicate word ids or metric names, more than 512 progress rows,
more than 32 metric rows, and out-of-range counters/timestamps. Unknown word ids and metric names
are **not** rejected: the merge looks them up, skips them, and counts them in `skipped`.

The merge is done in SQL in `src/worker/db/queries.ts`, never read-then-write:

- `progress` — one `INSERT ... ON CONFLICT(user_id, word_id) DO UPDATE`; the `CASE` keeps the row
  with the higher status rank (`new < learning < mastered`), then higher `strength`, then earlier
  `next_review_at`; a full tie keeps the stored row. `mastery_xp_awarded` is the OR of both.
- `profiles` — one `UPDATE` using `MAX` for counters and non-null timestamps, a `CASE` that keeps
  the stored value when the incoming one is `NULL` (otherwise `MAX`) for the nullable timestamps,
  and a lexicographic `MAX` for `last_streak_date`. Identity columns are absent from the statement.
- `metrics` — one `INSERT ... ON CONFLICT(user_id, name) DO UPDATE` with `MAX` for the value and a
  conditional `updated_at`.

Every statement is idempotent, so replaying the same payload changes nothing. Profile and metrics
share one atomic `db.batch` (≤33 statements); progress is written in chunks of **90** statements
because D1 caps bound parameters at 100. Progress is therefore not one atomic batch: a failed run
leaves a valid prefix and the retry converges.

### Admin routes

`src/worker/admin.ts` owns the staff boundary. Every route under `/v1/admin` runs the same ordered
chain **before any handler body**:

1. `Cache-Control: no-store` — set first, so not even an error response is cacheable;
2. `requireAuth` — an anonymous or invalid token is `401`;
3. `requireRole(["teacher", "admin"])` — a valid token without a staff role is `403` with the
   `forbidden` code and message *"This operation requires teacher or admin access."*

The role comes from the **verified token's** `roles` claim (`admin` > `teacher` > `user`).
`profiles.role` is never consulted, so a stale or tampered database row cannot grant access.

| Route | Access | Response |
|---|---|---|
| `GET /v1/admin/access` | teacher, admin | `{ role }` for the signed-in caller |
| `GET /v1/admin/content` | teacher, admin | one content snapshot (see below) |
| `POST /v1/admin/topics` | teacher, admin | create a topic; the id is derived (`201`) |
| `PATCH /v1/admin/topics/:id` | teacher, admin | edit bilingual title, icon, descriptions |
| `POST /v1/admin/topics/:id/archive` · `/restore` | teacher, admin | flip `archived_at` |
| `PUT /v1/admin/topics/order` | teacher, admin | renumber `sort_order` 1..N |
| `POST /v1/admin/packs` | teacher, admin | create a pack under a topic (`201`) |
| `PATCH /v1/admin/packs/:id` | teacher, admin | edit the bilingual title; the topic is immutable |
| `POST /v1/admin/packs/:id/archive` · `/restore` | teacher, admin | flip `archived_at` |
| `PUT /v1/admin/packs/order` | teacher, admin | renumber within a topic |
| `POST /v1/admin/words` | teacher, admin | create a word; the id is derived (`201`); an optional `packId` adds it to that pack in the same batch |
| `PATCH /v1/admin/words/:id` | teacher, admin | edit the word record; the id and `image` are not accepted |
| `PUT /v1/admin/packs/:id/membership` | teacher, admin | replace the pack's ordered word list (`1..N`) |

The snapshot differs from the public `/v1/content` bundle because the portal must edit what the
child app cannot see:

| Field | Contents |
|---|---|
| `contentVersion`, `dataset` | the same values `/v1/content` reports |
| `topics`, `packs` | **archived rows included**, each with `archivedAt`; ordered by `sortOrder` (packs grouped by their topic's order) |
| `words` | every word, including words assigned to no pack, each with `archivedAt`; ordered by id |
| `memberships` | one entry **per pack**, including empty packs, with `wordIds` in `position` order |

The pure mapper is `toAdminSnapshot(rows)` in `src/worker/adminContent.ts`; it shares the row reader,
`toWord`, and the select columns with the public bundle so the two views cannot drift.

**Write mechanics (feature 29).** `src/worker/adminWrite.ts` registers the write routes behind the
same three middleware. The shared mechanics live in `src/shared/adminWrite.ts`, so the portal and
the Worker agree on them:

- **Ids are generated, never accepted.** Topic ids are `slugify(title)`; a collision gets `-2`,
  `-3`, … across live and archived rows. Pack ids are `<topicId>-<n>`, the smallest positive number
  not used by that topic's packs (archived included). A non-Latin title falls back to `topic-1`,
  `topic-2`. Ids are immutable.
- **Body rules run before the database.** The body is parsed against an allowlist of fields; an
  unknown field (including `id` or, on a pack edit, `topicId`) is `422`. A blank required field is
  `422`, and so is an empty patch. Malformed JSON is `400 invalid_json`.
- **Concurrency.** A request may send `If-Match: "<contentVersion>"`. A version that is not the
  stored one is `409 conflict`; the portal refetches the snapshot under the banner. The header is
  optional so a script can write without one.
- **Validation before writing.** The change is applied to the loaded rows in memory, mapped through
  `toContentBundle`, and checked by the shared validator. Structural errors answer `422
  validation_failed` with an `issues` array in the error envelope, and nothing is written.
  Editorial warnings are returned in the successful response. `topic-no-packs` and `pack-no-words`
  are downgraded to warnings because the editor is incremental.
- **Atomic version bump.** The row write and
  `UPDATE content_meta SET content_version = <patch+1>` share one `db.batch`, so the public `ETag`
  changes exactly when content does. A rejected or no-op write bumps nothing.
- **Archive is soft and idempotent.** Only `archived_at` changes; a pack under an archived topic
  keeps `archivedAt: null` and is hidden by its ancestor in the read model. Archiving or restoring
  a row already in that state is a no-op. Editing an archived row is `409 archived`.
- **Ordering is a permutation.** The body lists every live id exactly once; a missing or extra id
  is `422`. Renumbering to the current order is a no-op.

**Word library and membership (feature 30).**

- **Word ids.** `w-<slugify(headword)>`, then `w-…-2`, `w-…-3` on collision across active and
  archived rows; a headword with no ASCII slug falls back to `w-1`, `w-2`. The id is read-only and
  never reused.
- **One headword, one word.** `text` is unique case-insensitively across every word, archived
  included, enforced by `words_text_nocase`. The route checks it against the loaded rows first, so a
  duplicate is `409 conflict` with the colliding id — not a constraint failure reported as a server
  error. An edit may keep its own headword. An archived word cannot be edited (`409 archived`).
- **No delete, no archive.** There is no word delete or archive route, and no such method is
  registered, so `DELETE /v1/admin/words/:id` answers `405` with `Allow: PATCH`. Removing a word
  from every pack is how it stops reaching children; the row and its library entry stay.
- **Create with a pack.** `POST /v1/admin/words` accepts an optional `packId`. The word insert, the
  `pack_words` insert at the next position, and the version bump share one `db.batch`; an archived
  pack or a pack under an archived topic is `409 archived` before anything is written. The response
  carries `word` and, when a pack was named, `membership`.
- **Membership is a full ordered replace.** `PUT /v1/admin/packs/:id/membership` takes
  `{ "ids": [...] }` in the intended order. The write deletes the pack's rows and inserts `1..N` in
  one atomic batch — `(pack_id, position)` is the primary key, so an in-place renumber cannot be
  partial. Inserts are chunked at 33 rows per statement to stay inside D1's 100-parameter cap.
- **Membership rules.** Duplicate ids (`duplicate-id`), unknown words, and archived words are `422
  validation_failed`, as is a list longer than 500. An archived pack or a pack under an archived
  topic is `409 archived`. Saving the current order is a no-op that bumps nothing; any accepted
  change bumps the pack's `updated_at` and the content version.
- **Words and the public bundle.** A word in no live pack is omitted from `/v1/content` but stays
  in `/v1/admin/content` and every pack that still holds it. An edit to a shared word changes every
  pack's appearance, because packs reference the one row. `image` is written only by feature 31's
  upload route; create and edit reject it as an unknown field.

**405 with `Allow`.** `ROUTES` declares the methods for each admin path. `routeMethodsFor` in
`src/worker/errors.ts` matches the exact path first, then registered `:param` patterns, so a wrong
method on `/v1/admin/topics/:id` answers `405` with `Allow: PATCH`, while `POST
/v1/admin/topics/order` answers `405` with `Allow: PUT`, not `404`.

**CORS.** `ALLOWED_METHODS` now includes `PUT`, and `ALLOWED_HEADERS` includes `If-Match` and
`If-None-Match`, so the portal's later conditional writes preflight cleanly. Origins stay
exact-matched. `https://admin.words.nioh.uk` and `http://localhost:8444` must be listed in
`ALLOWED_ORIGINS`.

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
  `ALLOWED_ORIGINS` does not list the page origin — `http://localhost:8443` for the child app or
  `http://localhost:8444` for the portal.

- A `403` on an admin route is correct for a signed-in account whose Entra app role is `user` or
  unassigned. Change the assignment; the next fresh token carries the new role.

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
