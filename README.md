# Words Wizard

A bilingual (English + 中文) offline-first PWA that helps Chinese-speaking children
aged 9–12 learn English vocabulary through short, game-like sessions with a virtual
word buddy.

**Status:** MVP requirements locked in [docs/PRD.md](docs/PRD.md) (v0.2). The production app is
scaffolded under [src/](src/), including its package manifest, configs, and build output. The Figma Make
export in [figma/](figma/) is a **read-only visual reference** — it is never edited, never imported,
and its toolchain is independent of the production app.

---

## What v1 is

- **5 topics × 3 packs × 20 words** (300 word slots) drawn from the Cambridge
  Starters/Movers/Flyers 2025 allowlist.
- **Fully bilingual:** English + 中文 UI and content, with a Settings toggle.
- **Five practice modes:** picture match, word → meaning, spelling builder,
  fill-the-blank, and listen & choose.
- **A virtual buddy:** create it, earn XP, grow through five stages, and keep it awake.
  It falls asleep after 7 days without practice and is always revivable.
- **My Words:** a countable Collection tab and an illustrated, mastered-only Word Book
  tab.
- **Monthly Review:** a 20-word retention check every 28 days.
- **Offline PWA:** IndexedDB via Dexie, no backend, no accounts, no sync, no telemetry.
- **Speech via the Web Speech API**, with IPA fallback when no suitable voice exists.
- **Cloudflare Pages** hosting, with hash routing.
- **315 illustrations:** ~300 word images plus 3 avatars × 5 stages, AI-generated and
  human-reviewed.

## Repository layout

| Path | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | v0.2 product requirements — the document of record |
| [docs/features/](docs/features/) | Mission 1 sprint index, the ordered feature specs, the backlog, and completed features under `archive/` |
| [docs/sample_data/](docs/sample_data/) | Inputs kept for reference, not the v1 content set: `Init/` (historical discovery notes, superseded by the PRD), the Cambridge 2025 word-list PDF, the early 36-word `words.json`, and `content/` (scaffold topics, packs, and words) |
| [src/](src/) | **Everything the app needs**: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`, `index.html`, React code, `src/public/` static assets, `src/scripts/` utilities, and the generated `src/dist/` build |
| Repository root | Only `README.md`, `LICENSE`, `.gitignore`, `docs/`, and `figma/` |
| [figma/](figma/) | Figma Make export, **read-only visual reference** — never edited or imported |

## Current content state

The content set is incomplete and is the critical path for the MVP. Everything in
[docs/sample_data/content/](docs/sample_data/content/) is scaffolding, not the v1
content set:

- 5 topics and 20 packs exist (4 packs per topic, 25 slots per pack = 500 slots), but
  only **57 words** are authored; **360 distinct referenced word IDs are missing**.
- Three of the five topics have no words yet.
- The sample words use the older English-only shape (`audioUrl`, `imageUrl`, a single
  `definition`, and string examples) with no IPA or Chinese fields. They will be
  migrated to the v0.2 bilingual schema; pronunciation will be synthesized, so no
  audio files are needed.
- The sample's 4-packs-of-25 shape is **not** the target. Target: **15 packs
  (3 per topic) × 20 words = 300 slots**, bilingual glosses, definitions, and examples,
  plus 300 word illustrations.
- No illustration assets exist yet.

Content is authored AI-assisted and then reviewed in full by a Chinese-speaking English
teacher. `pnpm validate:content` enforces schema completeness, ID integrity, both
languages, image existence, unlock values, and forbidden IP terms; it runs automatically
before every build. Cambridge allowlist membership is verified during content review
(feature 17) rather than by the validator.

## Run the app

The package manifest lives in `src/`, so run every command from there:

```bash
cd src
pnpm install
pnpm dev
```

The dev server serves on **http://localhost:8443**. Every app file — `package.json`,
`tsconfig.json`, `vite.config.ts`, `index.html`, React code, and static assets — lives under
`src/`. The repository root stays clean.

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server on port 8443 |
| `pnpm build` | Production build into `src/dist/` |
| `pnpm preview` | Serve the built `src/dist/` on port 8443 |
| `pnpm validate:content` | Check the bundled content JSON; runs before `pnpm build` |
| `pnpm test` | Vitest, single run (`**/*.test.ts` under `src/`) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Format with oxfmt |

### Local data

The app stores everything in IndexedDB under the database name `WordsWizardDB`. The
Figma prototype used the same name on the same port with an incompatible version-1
schema (`profiles` only). Dexie will not reinterpret a version it did not create, so if
you ever ran the prototype in this browser, **clear site data for `localhost:8443` once**
before running the app. Demo records from the prototype are deliberately not migrated.

The dev-only route table at `#/__routes` can seed a profile with one committed session
and can drop the database, which is the quickest way to check first-run routing and
persistence before character creation (feature 06) exists.

Progress is held in memory for the length of a session and written once at the end. A
browser kill or force-quit mid-session therefore loses that session's answers; everything
committed by earlier sessions survives. This is the accepted loss window, not a bug.

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

The root app uses **Vitest** for pure domain logic — XP and stage derivation, vitality and
sleep, streak grace, Care Token ledger, SM-2 scheduling, session building, Monthly Review
selection, Collection selectors, i18n key completeness, and content integrity. Tests live
beside the code as `src/**/*.test.ts` and run offline.

**Manual end-to-end checks** on iPad Safari and Edge remain the tier for install, offline
behavior, IndexedDB persistence, service-worker updates, and Web Speech. There is no
component-test suite; UI is verified in the browser.

## Deployment

Planned: **Cloudflare Pages** (Free plan, Direct Upload), deployed by GitHub Actions from
`master`. The prebuilt `src/dist/` is deployed by running
`wrangler pages deploy dist --project-name words-wizard --branch master` from `src/`, and
`src/public/_headers` — copied into the build — carries the cache policy. Hash routing means
no SPA rewrite is needed, so no `_redirects` file is used and a missing file keeps a real
404. Cloudflare serves MIME types itself, so no per-extension upload step is needed. The
service worker precaches the shell, content, locales, and all illustrations.

The workflow reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from repository
secrets; no credential is committed. Release flow: merge into `master`, which redeploys the
production site. Rollback is a Cloudflare Pages deployment rollback, or re-running the
workflow on an older commit. Custom domains are attached to the Pages project with automatic
TLS and are not part of the deployment workflow.

## Key decisions

The full decision log is in §14 of [docs/PRD.md](docs/PRD.md).
The most important changes from the original concept:

- Bilingual UI and content, not English-only.
- Web Speech API instead of bundled audio.
- A strong, repeated install prompt instead of a hard installation gate.
- Five topics and all five practice modes in the MVP.
- Character stage and vitality are derived, never stored.
- Monthly Review is on a rolling 28-day cycle.
- Single-profile UI; `profileId` stays in the schema for a future switcher.
- Local metrics only; no telemetry.

## License

See [LICENSE](LICENSE).
