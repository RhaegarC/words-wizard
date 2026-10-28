# Feature 22 — D1 Content Store & Content API

> Priority: Must (release blocker) · Mission 2 · **Status: Planned — documentation only**
> Depends on: 21 (Worker edge, config, CORS, error envelope). Blocks: 23, 24; feature 17 continues
> here.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Move the authoritative content set — topics, packs, words, examples, avatars, and artwork metadata —
from bundled JSON into Cloudflare D1, and serve it from a public, cacheable `GET /v1/content`.
Seed the current 120 authored words and their 300 pack slots, including the 180 slots that are still
unauthored, so feature 17 can fill them with later migrations rather than a new app build.

The API response is the existing `ContentBundle` shape. The SPA's accessor changes to read a bundle
loaded at boot; the actual fetch wiring lands in feature 24. Bundled content JSON is deleted in this
feature.

## User story

As a **child**, the words I practise are the same on every device, and a corrected definition reaches
me without reinstalling the app. As a **content author**, I ship a word by writing a reviewed
migration, not by editing a JSON file and rebuilding the SPA. As an **operator**, I can ask the API
which content version is live.

## D1 schema (content)

All tables live in `src/worker/db/schema.ts`; migrations are generated into `src/worker/drizzle/`.
Foreign keys are enforced by D1; there is no `BEGIN`/`COMMIT` in migrations.

| Table | Columns |
|---|---|
| `content_meta` | `id = 1`, `schema_version`, `dataset` (`dev` \| `final`), `content_version` |
| `topics` | `id PK`, `title`, `title_zh`, `icon`, `description`, `description_zh`, `sort_order` |
| `packs` | `id PK`, `topic_id FK topics`, `title`, `title_zh`, `sort_order`, `unlock_type`, `unlock_value` |
| `pack_words` | `pack_id FK packs`, `position`, `word_id TEXT NULL FK words`, `PK(pack_id, position)`, `UNIQUE(pack_id, word_id)` |
| `words` | `id PK`, `text`, `phonetic`, `part_of_speech`, `meaning_en`, `meaning_zh`, `definition_en`, `definition_zh`, `image`, `emoji`, `level CHECK 1..3`, `tags JSON` |
| `word_examples` | `word_id FK words`, `position`, `en`, `zh`, `PK(word_id, position)` |
| `word_topics` | `word_id FK words`, `topic_id FK topics`, `PK(word_id, topic_id)` |
| `avatars` | `id PK`, `name`, `name_zh`, `color`, `pale`, `sort_order` |
| `avatar_stages` | `avatar_id FK avatars`, `stage`, `file`, `PK(avatar_id, stage)` |
| `artwork` | `word_id PK FK words`, `file`, `status CHECK ('approved','placeholder')` |

**Unauthored slots.** Mission 1 has 300 pack slots but only 120 authored words. `pack_words.word_id`
is therefore nullable; `NULL` marks a slot that feature 17 will fill. The API maps a `NULL` slot to a
synthetic id (`unresolved:<pack-id>:<position>`) so `Pack.wordIds` always has 20 entries and the
existing validator reports it as an unresolved reference — a warning while `dataset = 'dev'`, an
error once `dataset = 'final'`. SQLite's `UNIQUE` ignores `NULL`, so the position key keeps slots
distinct while they are unresolved.

## Acceptance criteria

### Schema and migrations

- [ ] The generated foundation migration creates the content tables above with the declared keys,
      foreign keys, and check constraints. It is produced by `drizzle-kit generate`, reviewed, and
      committed.
- [ ] The content-seed migration seeds the current dataset: 5 topics, 15 packs, 300 `pack_words`
      rows (120 resolved, 180 `NULL`), 120 words, their examples and topic links, 8 avatars × 5
      stages, and 120 artwork rows. It is produced once by a throwaway generator, reviewed line by
      line, and committed; the generator is not kept.
- [ ] `content_meta` is a single row with the current `schemaVersion`, `dataset: "dev"`, and a bumped
      `contentVersion`.
- [ ] Migrations apply cleanly to a fresh local D1 database with
      `wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc`, and re-running the
      apply is a no-op.
- [ ] The migration is idempotent only in the sense D1 requires: each file runs once. No
      `INSERT OR REPLACE` silently rewrites authored ids.
- [ ] Every content migration bumps `contentVersion`; the API's `ETag` and `/health` read it, so a
      stale edge cache is detectable.
- [ ] Content ids are additive from here on: a migration never deletes or renames a word, topic, or
      pack id, so an in-flight session remains valid.
- [ ] `GET /health` now includes `contentVersion` read from `content_meta`; it stays public and
      `no-store`.

### Content API

- [ ] `GET /v1/content` returns the full `ContentBundle`:
      `{ meta, topics, packs, words, avatars, artwork }`, with the same field names and value shapes
      the SPA already consumes.
- [ ] `packs[].wordIds` always has 20 entries in `position` order; unresolved slots use the synthetic
      id described above.
- [ ] `artwork` is the map `wordId -> { file, status }` used by the existing renderer.
- [ ] The response carries a strong `ETag` derived from `contentVersion`, `Cache-Control: public,
      max-age=300`, and CORS headers for the allowed origins.
- [ ] `If-None-Match` with the current ETag returns `304` with no body and the same cache headers;
      any other value returns `200`.
- [ ] The endpoint is public: no token is required, and a token is not rejected if present.
- [ ] A D1 failure returns `500 internal` in the error envelope; it never returns an empty bundle
      that a client could mistake for real content.

### Client content source

- [ ] `src/page/content/index.ts` stops importing JSON. It exposes `loadContent(bundle)` and keeps the
      existing read accessors (`getTopics`, `getWord`, `getAvatarSet`, `getArtwork`, `getAllWords`,
      and the rest) over a module-level frozen bundle.
- [ ] Accessors behave sensibly before a bundle is loaded (empty collections, `undefined` for a
      lookup) so the app can boot to a loading state instead of throwing.
- [ ] The static JSON files (`topics.json`, `packs.json`, `words.json`, `avatars.json`,
      `content-meta.json`, and `art/manifest.json`) and the tests that read them are deleted.
- [ ] `forbidden-terms.json`, `cambridge-allowlist.json`, `EXCEPTIONS.md`, and `REVIEW.md` move to
      `src/shared/content/rules/`, remain the authoring rules, and are never shipped in the client
      bundle. `pnpm extract:wordlist` points at the new allowlist path.
- [ ] `prebuild` and `validate:content` are removed from `package.json`, and CI stops calling them:
      they validated files that no longer exist. Their replacement is the D1 integrity test below.
- [ ] Artwork files stay at `src/page/public/art/`; the API stores only the relative `file` and
      `status`.

### Content integrity gate

- [ ] A database-tier test assembles a bundle from the local D1 database using the same
      `src/worker/content.ts` mapping the route uses, and runs the existing
      `validateContent` from `src/shared/content/validate.ts` with `forbiddenTerms` and a real
      `artExists` check against `src/page/public/`.
- [ ] With `dataset = 'dev'` the test requires **zero errors**; the only warnings allowed are the
      known unresolved slots and placeholder art, and their number is asserted exactly so a new
      warning cannot slip in.
- [ ] The same test asserts: 5 topics × 3 packs × 20 slots, every resolved reference points at a
      word, every word has at least one example, levels are 1–3, 8 avatars × 5 stages, and every
      artwork `file` exists on disk.
- [ ] The final-dataset run (`dataset = 'final'`, feature 17) requires zero errors and zero
      warnings; it is the release gate, not a build step.
- [ ] Content changes after this feature are authored as reviewed migration files; the validator
      runs against D1, not against a checked-in JSON snapshot.

### Remote D1 tier (gated)

- [ ] `pnpm test:db:remote` applies the migration set to a dedicated `words-wizard-test` database and
      asserts the constraints and content counts a local run asserts.
- [ ] It reads `WORDS_TEST_CLOUDFLARE_API_TOKEN`, `WORDS_TEST_CLOUDFLARE_ACCOUNT_ID`, and
      `WORDS_TEST_D1_DATABASE_ID` — names distinct from any production credential — and **skips**
      with a visible summary when they are absent. It never touches the production database.
- [ ] A reachable test database that rejects a migration is a failure, not a skip: that is the bug
      the tier exists to find.

## API surface added

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | `{ ok, contentVersion }` |
| GET | `/v1/content` | public | Full `ContentBundle`; ETag + `304` |

## Tasks (ordered)

1. Add the Drizzle content schema and generate the foundation migration.
2. Generate the content-seed migration from the current JSON with a throwaway script: topics, packs,
   `pack_words` (including `NULL` slots), words, examples, topic links, avatars, stages, artwork, and
   `content_meta`. Review every row.
3. Apply both migrations to a fresh local D1 and inspect `PRAGMA foreign_key_check`.
4. Implement `src/worker/content.ts`: read the tables, assemble the bundle in the existing shape,
   map `NULL` slots, and expose `contentVersion`.
5. Add `GET /v1/content` with ETag / `If-None-Match` handling and cache headers; extend `/health`.
6. Add the database-tier integrity test and the remote gated variant.
7. Rewrite `src/page/content/index.ts` around `loadContent(bundle)`; delete the JSON files and the
   JSON-reading tests.
8. Remove `prebuild` / `validate:content` and their CI step; keep the build otherwise unchanged.
9. Rewrite [feature 17](17-content-production.md) for D1 authoring: migrations, review, the same
   validator, and the final gate.

## Tests

| Tier | What it proves |
|---|---|
| **Unit** (always) | Mapping from rows to `ContentBundle` (ordering, 20 slots per pack, unresolved ids, artwork map, tags JSON); ETag generation and `If-None-Match` decisions; content-version parsing. |
| **Model** (always) | Generated SQL declares the keys, check constraints (`level`, `artwork.status`), nullable `pack_words.word_id`, and the foreign keys the docs claim; no relationship exists that the docs do not mention. |
| **Database / host** (local, always) | Migrations apply to a real D1; foreign keys reject a dangling word/topic; the level and status checks reject out-of-set values; 300 slots, 120 resolved words, 8 avatars × 5 stages round-trip; the assembled bundle passes `validateContent` with zero errors; the route returns the bundle, ETag, `304`, and cache headers; the run's database outlives the run. |
| **Remote** (gated) | The same migration set and constraints hold on Cloudflare's engine; skips visibly without test credentials. |
| **Manual** | `curl` on the deployed `/v1/content` shows the expected ETag and a `304` on revalidation; each topic renders its words and art. |

**RED-first hot spots**

- The integrity test and the migration before the seed exists: the validator must fail on an empty or
  partially seeded database for the expected reasons.
- ETag/`304` behaviour before the route implements it.
- The "no dangling reference" constraint test before the schema is declared final.

## Non-goals

- No content CMS, editor, or admin API.
- No new topics, words, or art; feature 17 owns authoring.
- No user data; feature 23 owns profiles, progress, and sessions.
- No client fetch wiring; feature 24 owns boot, caching, and the offline screen.
- No content deletion or renaming, ever, in a migration.
