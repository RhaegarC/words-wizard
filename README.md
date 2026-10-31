# Words Wizard

A bilingual (English + 中文) PWA that helps Chinese-speaking children aged 9–12 learn English
vocabulary through short, game-like sessions with a virtual word buddy.

**Status:** [docs/PRD.md](docs/PRD.md) is v0.3, the Mission 2 online architecture: Microsoft Entra
ID sign-in, a Cloudflare Worker API, and D1 for content and per-user progress (see
[docs/features/00-mission-2-sprint.md](docs/features/00-mission-2-sprint.md)). Mission 3, the
teacher/admin content portal, is scoped but not detailed in
[docs/features/00-mission-3-sprint.md](docs/features/00-mission-3-sprint.md). The production app is
scaffolded under [src/](src/), including its package manifest, configs, and build output. The Figma Make
export in [figma/](figma/) is a **read-only visual reference** — it is never edited, never imported,
and its toolchain is independent of the production app.

---

## What v1 is

- **Topics and day-sized packs with no fixed counts**, drawn from the Cambridge
  Starters/Movers/Flyers 2025 allowlist. A word may appear in packs of several topics; each pack
  introduces it anew.
- **Fully bilingual:** English + 中文 UI and content, with a Settings toggle.
- **Five practice modes:** picture match, word → meaning, spelling builder,
  fill-the-blank, and listen & choose.
- **A virtual buddy:** create it, earn XP, grow through five stages, and keep it awake.
  It falls asleep after 7 days without practice and is always revivable.
- **My Words:** a countable Collection tab and an illustrated, mastered-only Word Book
  tab.
- **Monthly Review:** a 20-word retention check every 28 days.
- **Online PWA:** Microsoft Entra ID sign-in, a Cloudflare Worker API, and D1 for content and
  per-user progress. There is no offline practice and no Dexie store after Mission 2.
- **Speech via the Web Speech API**, with IPA fallback when no suitable voice exists.
- **Cloudflare Pages + Worker** hosting, with hash routing.
- **Illustrations:** word images served from R2 URLs (emoji fallback until authored) plus 8 buddy
  portraits, AI-generated and human-reviewed.

## Repository layout

| Path | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | v0.3 product requirements — the document of record |
| [docs/features/](docs/features/) | Mission 1–3 sprint indexes, the ordered feature specs, the backlog, and completed features under `archive/` |
| [docs/sample_data/](docs/sample_data/) | Inputs kept for reference, not the v1 content set: `Init/` (historical discovery notes, superseded by the PRD), the Cambridge 2025 word-list PDF, the early 36-word `words.json`, and `content/` (scaffold topics, packs, and words) |
| [src/](src/) | **Everything the app needs**: the package, `pnpm-lock.yaml`, TypeScript/Vite configs, `src/page/` (React SPA and assets), `src/shared/` (pure domain), `src/worker/` (API, added in feature 21), and the generated `src/dist/` build |
| Repository root | Only `README.md`, `LICENSE`, `.gitignore`, `docs/`, and `figma/` |
| [figma/](figma/) | Figma Make export, **read-only visual reference** — never edited or imported |

## Current content state

Content is the critical path for the MVP. Everything in
[docs/sample_data/content/](docs/sample_data/content/) is Mission 1 scaffolding; it is not the
target content set.

Mission 2 stores the vocabulary in four D1 tables — `topics`, `packs`, `words`, and `pack_words`
— with no fixed count of any of them. Topics are the starter word list's categories; packs are day-sized
sub-categories, and a pack may span several days. One row represents one headword; a word may
belong to packs of several topics and is introduced anew in each, while mastery stays at word
level. See [feature 22](docs/features/archive/22-d1-content-store.md).

Content is authored AI-assisted, reviewed in full by a Chinese-speaking English teacher, and
committed as reviewed migration SQL. The integrity gate assembles the bundle from D1 and runs
`validateContent`: structural rules always, editorial rules (Cambridge allowlist, abstract-word
coverage, first example containing the headword, forbidden IP terms) at `dataset: "final"`.
`docs/sample_data/vocab.json` is reference input for the topic and headword list, not a seed file.

## Run the app

The package manifest lives in `src/`, so run every command from there. The SPA reads four
build-time variables; copy the example and fill in the Entra registration:

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

`.env` is gitignored. The Worker reads its own vars from
`src/worker/wrangler.jsonc`; replace the `REPLACE_WITH_*` placeholders with the same tenant
and client for local sign-in. Those values are public configuration, never secrets.

Content and progress live in D1, so apply migrations and start both processes:

```bash
pnpm exec wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc
pnpm worker:dev   # terminal 1, http://localhost:8787
pnpm dev          # terminal 2, http://localhost:8443
```

The dev server serves on **http://localhost:8443**. The package and build configs live in
`src/`; the React app and its assets live in `src/page/`, and pure domain code lives in
`src/shared/`. The repository root stays clean.

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server on port 8443 |
| `pnpm worker:dev` | Wrangler dev server for the Worker on port 8787 |
| `pnpm build` | Production build into `src/dist/` |
| `pnpm preview` | Serve the built `src/dist/` on port 8443 |
| `pnpm test` | Vitest, single run (page, shared, and worker tests) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:db:remote` | Remote D1 tier; skips unless `WORDS_TEST_*` is set |
| `pnpm typecheck` | `tsc --noEmit` for the page, test, and worker projects |
| `pnpm worker:typecheck` | `tsc --noEmit` for the Worker only |
| `pnpm check:dist` | Verify the built shell, assets, icons, locales, and `_headers` |
| `pnpm check:deploy` | Post-deploy smoke check for Pages and the Worker |
| `pnpm format` | Format with oxfmt |

Content integrity is checked by the database-tier tests, not by a prebuild step.

### Local data

Mission 1 stored everything in IndexedDB under the database name `WordsWizardDB`. Mission 2
moves content and progress to D1; feature 24 deletes the old database once on first load and shows
a notice. The Figma prototype used the same name on the same port with an incompatible version-1
schema (`profiles` only), so if you ran the prototype in this browser, **clear site data for
`localhost:8443` once**. Demo records from the prototype are deliberately not migrated.

The dev-only route table at `#/__routes` can seed a server profile through the same
provider the app uses and can clear local state (the unsent outbox and device flags). It
cannot reset or drop the D1 profile.

Progress is held in memory for the length of a session and written once at the end. If
that commit cannot reach the API, the finished session waits in the local outbox and is
replayed on the next boot. A browser kill before the session ends loses that session's
answers; everything committed by earlier sessions survives. This is the accepted loss
window, not a bug.

### Prototype reference (read-only)

The Figma Make export in `figma/` is kept **exactly as exported**, so it can be re-synced
or compared at any time. Do not move files out of it, edit it, or import from it. Its
toolchain is independent of the root app.

To view the prototype, run it from its own directory (it also uses port 8443, so stop the
app dev server first):

```bash
cd figma
pnpm install
pnpm dev
```

## Testing

The app uses **Vitest** across the tiers in the project's testing standard:

- **Unit** — pure domain logic: XP and stage derivation, vitality and sleep, streak grace,
  Care Token ledger, SM-2 scheduling, session building, Monthly Review selection, Collection
  selectors, auth config, and i18n key completeness.
- **Model** — the Drizzle schema and the SQL it generates.
- **Database** — a local D1 database through `wrangler`, including migrations and constraints.
- **Host** — the Worker booted in-process against unreachable connection strings.
- **Remote D1** — `pnpm test:db:remote`, which runs only when
  `WORDS_TEST_CLOUDFLARE_API_TOKEN`, `WORDS_TEST_CLOUDFLARE_ACCOUNT_ID`, and
  `WORDS_TEST_D1_DATABASE_ID` are set. It never reads a production `CLOUDFLARE_API_TOKEN`.
- **Doc-assertion** — the deployment and documentation contract in
  `src/page/scripts/deployment-config.test.ts`.

Tests live beside the code as `src/page/**/*.test.ts`, `src/shared/**/*.test.ts`, and
`src/worker/**/*.test.ts`. The database and remote tiers skip visibly when their engine or
credentials are unavailable; a skip is reported, not silent.

**Manual end-to-end checks** on iPad Safari and Edge remain the tier for install, Entra sign-in,
online-only boot, service-worker updates, and Web Speech. There is no component-test suite; UI is
verified in the browser.

## Deployment

**Cloudflare's Git integration** owns both deployments: Pages builds and serves the SPA at
<https://words.nioh.uk>, and Workers Builds deploys the API at
<https://wordsapi.nioh.uk>. There is no GitHub deployment workflow and no Cloudflare
deploy token in this repository. The full production setup is in
[docs/operations.md](docs/operations.md), with per-project notes in
[docs/deploy/page.md](docs/deploy/page.md) and [docs/deploy/worker.md](docs/deploy/worker.md).

Pages project settings:

- **Production branch:** `master`
- **Root directory:** `src` (the package manifest lives there)
- **Build command:** `pnpm build`
- **Build output directory:** `dist`
- **Environment:** Node 22 and pnpm 10, plus the four `VITE_*` variables below
- **Preview deployments:** off — a preview URL would publish before a release is reviewed

Workers Builds settings:

- **Root directory:** `src`
- **Deploy command:** `wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc && wrangler deploy --config worker/wrangler.jsonc`
- **Production branch:** `master`
- **Preview builds:** off

The Pages build needs `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`,
`VITE_ENTRA_SCOPE`, and `VITE_API_BASE_URL` in its environment; they are public
configuration. The Worker reads its vars from `src/worker/wrangler.jsonc`, and the D1
database id goes in `d1_databases[0].database_id`.

Pull requests to `develop` run `.github/workflows/ci.yml`: frozen pnpm install,
`typecheck`, `test`, `build`, and `check:dist`. A second job runs `pnpm test:db:remote`
only when the three `WORDS_TEST_*` secrets exist; otherwise it reports a visible skip.
Neither job deploys.

`src/page/public/_headers` — copied into the build — carries the cache policy. Hash routing means
no SPA rewrite is needed, so no `_redirects` file is used and a missing file keeps a real
404. Cloudflare serves MIME types itself, so no per-extension upload step is needed. The
service worker precaches the shell, locales, and the remaining bundled art; D1 content and R2
images are fetched at runtime. `check:dist` fails the build if the shell, worker, hashed
assets, locales, icons, or `_headers` are missing.

After a deploy, run `pnpm check:deploy`. It checks the Pages document and a hashed asset,
the Worker `/health`, the content endpoint's version and ETag, the allowed CORS origin, and
that an unlisted origin gets no CORS header. Set `EXPECTED_CONTENT_VERSION` to fail on a
stale release.

## Key decisions

The full decision log is in §14 of [docs/PRD.md](docs/PRD.md).
The most important changes from the original concept:

- Bilingual UI and content, not English-only.
- Web Speech API instead of bundled audio.
- A strong, repeated install prompt instead of a hard installation gate.
- Topics are the starter word list's categories; all five practice modes ship in the MVP.
- Character stage and vitality are derived, never stored.
- Monthly Review is on a rolling 28-day cycle.
- One profile per Entra identity; no profile switcher.
- Online-only: no offline practice, and a failed API call shows retry.
- Per-user metrics in D1; no telemetry.

## License

See [LICENSE](LICENSE).
