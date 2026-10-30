# Feature 25 — Deployment, Domains & Documentation

> Priority: Must (release gate) · Mission 2 · **Status: In progress — CI, smoke check, and
> documentation implemented; infrastructure and production deployment are operator-owned**
> Depends on: 21–24. Blocks: public release.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Make the documentation true and the repository ready for the real domain. The repository half
rewrites CI and the deployment policy test, extends `check:deploy` to the Worker and CORS, replaces
the Mission 1 PRD assumptions with PRD v0.3, and records the Entra setup, D1 operations, admin
deletion procedure, and privacy note. The **operator half** creates the production and test D1
databases, connects Workers Builds and Pages, attaches `wordsapi.nioh.uk` and `words.nioh.uk`, sets
the production environment, and runs the production smoke check.

After the repository half, `develop` is deployable and every document describes the online product.
The production URLs go live when the operator completes the other half.

## User story

As the **product owner**, I can ship a change to the Worker or the SPA through the normal branch and
PR flow, and the deployed app and API agree. As an **operator**, I can find how the tenant, database,
domains, and deletion procedure are configured without reading the code. As a **parent**, I can read
a short, accurate statement of what is stored about my child.

## Deployment topology

| Piece | Setting |
|---|---|
| Pages project | Root directory `src`, build `pnpm build`, output directory `dist` (i.e. `src/dist` on disk), Git integration on, previews off |
| Pages env | `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_SCOPE`, `VITE_API_BASE_URL=https://wordsapi.nioh.uk` |
| Worker Builds | Connected to `src/`; install `pnpm install --frozen-lockfile`; deploy `wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && wrangler deploy --config worker/wrangler.jsonc` |
| Worker vars | `JWKS_URL`, `TOKEN_ISSUER`, `EXPECTED_AUDIENCE`, `EXPECTED_TENANT`, `ALLOWED_ORIGINS` (production plus `http://localhost:8443`); no secret |
| D1 production | `words-wizard`, binding `DB`, id committed in `wrangler.jsonc` |
| D1 test | `words-wizard-test`, used only by the gated remote tier |
| Custom domains | `words.nioh.uk` (Pages), `wordsapi.nioh.uk` (Worker custom domain) |
| TLS / DNS | Cloudflare-issued certificates; no manual origin certificate |

Workers Builds is pre-authenticated by Cloudflare, so **no Cloudflare deploy token is stored in
GitHub**. The remote D1 test job is the only place CI needs Cloudflare credentials, and it is
credential-gated.

## Acceptance criteria

### Infrastructure (operator-owned)

- [ ] The production D1 database exists, its id is in `src/worker/wrangler.jsonc`, and the full
      migration set applies to it from the Worker Builds deploy command.
- [ ] The `words-wizard-test` database exists for the remote tier; the production database is never
      named by a test command.
- [ ] `wordsapi.nioh.uk` resolves to the Worker with a valid certificate, and
      `https://wordsapi.nioh.uk/health` returns `200` with `{ ok: true, contentVersion }`.
- [ ] `words.nioh.uk` serves the Pages build over HTTPS, the hash routes work on a hard reload, and
      the service worker updates through the prompt.
- [ ] CORS from `https://words.nioh.uk` succeeds; an unlisted origin receives no
      `Access-Control-Allow-Origin`.
- [ ] Pages preview deployments remain off; `delete-preview.yml` stays as a delete-only safety net.
      No branch environment is created.
- [ ] No GitHub Actions workflow contains a Cloudflare **deploy** token, `wrangler pages deploy`, or
      a Pages direct-upload step.

### CI and checks

- [x] `pnpm typecheck` covers page, worker, and tests; `pnpm test` includes the local D1 harness and
      the client seam test.
- [x] `pnpm build` + `pnpm check:dist` still pass; the `prebuild` / `validate:content` removal from
      feature 22 is confirmed and no doc still references the JSON validator.
- [x] A separate `test:db:remote` job runs only when the test credentials are present and reports a
      visible skip otherwise.
- [x] `src/page/scripts/deployment-config.test.ts` is rewritten for the new topology: it asserts the
      CI steps, the absence of direct Pages uploads, the Worker Builds/migration contract, and the
      test-only credential naming. It also keeps the narrow assertion that no workflow uses a
      Cloudflare deploy token; the only exception is `delete-preview.yml`, which may hold account
      credentials solely to delete a preview.
- [x] `check:deploy` checks the Pages origin, one hashed asset, and the Worker `/health`, and fails
      loudly on a stale content version or a missing CORS header.
- [x] The full suite is green locally; the remote tier skips visibly when its three credentials are
      absent.

### Documentation

- [x] **`docs/PRD.md` v0.3** replaces the Mission 1 posture: goals/non-goals (§2), key decisions
      (§4), architecture and storage (§8, replacing the Dexie schema with the API/D1 model), hosting
      and deployment (§8.9), phased delivery (§13), decision log (§14), success metrics (§15), and
      the screen inventory (sign-in). Offline-first claims are marked superseded, not silently left.
- [x] **`docs/operations.md`** records: tenant and app registration (SPA redirect URIs, exposed API
      scope, manifest values), Worker vars, D1 creation and binding, migration apply commands,
      Workers Builds setup, custom domains, log/health checks, rollback, and the **admin-only data
      deletion procedure** — a single cascade delete by `oid`, run against production only with
      explicit approval.
- [x] **`docs/privacy.md`** states what is stored (`oid`, character name, avatar, topic, locale, XP,
      streak, progress, metrics, session history), what is **not** stored (email, Entra display name,
      photo, tenant list), where it lives (Cloudflare D1; Microsoft handles authentication), that
      there is no analytics or advertising, that deletion is by request through the operator, and how
      to ask. `src/page/public/privacy.html` is linked from Settings and carries the same facts.
- [x] **README** describes local development with a local Worker and D1, the environment variables,
      the test tiers and their skip behaviour, the build, and the deploy path.
- [x] `docs/features/17-content-production.md` describes D1 authoring (migrations, review, validator)
      and its real status; Mission 1's sprint index is moved to `archive/` with its links fixed and a
      historical banner.
- [x] The backlog no longer says accounts, a backend, or cloud sync are rejected for v1; those rows
      move to the current mission or to future candidates, and the new out-of-scope items are listed.
- [ ] Every command in the docs has been run, or a `Verification:` line records what was observed and
      what could not be verified locally. `docs/operations.md` carries the line; this is completed
      once the operator's production commands are recorded.

## Tasks (ordered)

1. **Operator:** create `words-wizard`; copy its id into `wrangler.jsonc`; apply the migration set
   locally and then remotely; confirm `PRAGMA foreign_key_check`.
2. **Operator:** create `words-wizard-test`; add its id to the test environment (not to the
   production config).
3. **Operator:** connect the Worker to Workers Builds with the install/deploy commands; confirm a
   deploy runs migrations before `wrangler deploy`.
4. **Operator:** add `wordsapi.nioh.uk` as a Worker custom domain and confirm TLS and `/health`.
5. **Operator:** add `words.nioh.uk` to the Pages project; set the four `VITE_*` env vars; redeploy.
6. [x] Rewrite `.github/workflows/ci.yml`: typecheck page+worker+tests; run the suite; build and
   `check:dist`; add the gated remote job; confirm feature 22 already removed `validate:content`.
7. [x] Rewrite `deployment-config.test.ts` for the topology above; run it red first, then green.
8. [x] Extend `check-deploy.mjs` to the Worker health and CORS checks; production run is
   operator-owned.
9. [x] Write `docs/operations.md` and `docs/privacy.md` from the commands actually run.
10. [x] Rewrite the README; update feature 17 and the backlog.
11. [x] Revise the PRD to v0.3; update the Mission 2 sprint statuses; archive Mission 1's sprint
    index.
12. **Operator:** run the manual acceptance list from the sprint and record the evidence in the PR.

## Tests

| Tier | What it proves |
|---|---|
| **Doc assertion** (always) | `deployment-config.test.ts` reads the workflows and `wrangler.jsonc` and asserts the topology: Pages Git integration, no direct Pages upload, Worker Builds/migration deploy, test-only Cloudflare credential names, no `_redirects`, expected CI steps. |
| **Host** (always) | The local harness still passes after the config move; `/health` shape and CORS are unchanged. |
| **Remote** (gated) | The production-shaped migration set applies to the test D1 and the constraints hold. |
| **Verification-only** (recorded, not a test) | The custom domains, TLS, real Entra sign-in, and the production `check:deploy` run. These are deployment facts, not behaviours a unit test can assert; the PR carries a `Verification:` line with the commands and observed output. |

**RED-first hot spots**

- The rewritten policy test before the CI/config change; it should fail on the old workflow and pass
  only when the topology is right.
- `check:deploy` extended before the domain exists, so its failure is observed, then its pass is
  recorded.
- The remote tier's skip path before credentials are configured, so a skip is visible and not
  mistaken for a pass.

## Rollback and operational notes

- **Migrations are forward-only.** D1 has no down migrations; a bad content or schema migration is
  fixed by a new migration, not reverted. This is why every migration is reviewed and why content
  changes are additive.
- **Worker rollback** uses the previous Workers Builds deployment; **Pages rollback** uses the
  previous Pages deployment. A rollback that crosses a bad migration still needs a forward fix.
- **Deletion is operator-only.** There is no endpoint or UI. The procedure deletes the `users` row,
  and user-owned rows cascade; it is run against production only with explicit approval and is
  recorded in the operations log.
- **No secrets in the repo.** Entra ids and the Worker vars are public configuration; the only
  secrets are the test D1 credentials held by CI/your shell, named `WORDS_TEST_*`.

## Non-goals

- No staging environment or branch previews.
- No automated Entra tenant provisioning.
- No content CMS or admin UI.
- No analytics, uptime monitor, or alerting beyond `check:deploy` and Worker logs.
- No migration of Mission 1 Dexie data.
