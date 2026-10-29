# Feature 22 — D1 Content Store & Content API

> Priority: Must (release blocker) · Mission 2 · **Status: Planned — documentation only**
> Depends on: 21 (Worker edge, config, CORS, error envelope). Blocks: 23, 24; feature 17 continues
> here.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Move the authoritative vocabulary set — topics, packs, words, and pack membership, plus the
unchanged avatars — from bundled JSON into Cloudflare D1, and serve it from a public, cacheable
`GET /v1/content`. The model is four vocabulary tables: `topics`, `packs`, `words`, and
`pack_words`.

A pack is a topic sub-category of **unbounded size**. A daily session takes up to five words that
are not yet introduced in the current pack, so a pack may span several days. One word may appear in
packs of several topics; it is introduced anew in each, while mastery stays at word level.

This sprint's content is seeded by reviewed SQL authored for the vocabulary; there is no fixed
topic, pack, or word count.

The API response is the existing `ContentBundle` shape, with `Topic.packIds`, `Pack.unlockRule`,
and the artwork manifest removed. The SPA's accessor changes to read a bundle loaded at boot; the
actual fetch wiring lands in feature 24. Bundled content JSON is deleted in this feature.

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
| `topics` | `id PK` (immutable slug), `title`, `title_zh`, `icon`, `description`, `description_zh`, `sort_order`, `created_at`, `updated_at`, `archived_at NULL` |
| `packs` | `id PK`, `topic_id FK topics`, `title`, `title_zh`, `sort_order`, `created_at`, `updated_at`, `archived_at NULL` |
| `words` | `id PK`, `text`, `phonetic`, `part_of_speech`, `meaning_en`, `meaning_zh`, `definition_en`, `definition_zh`, `examples JSON` (`[{en, zh}]`), `image NULL` (R2 URL), `emoji NULL`, `level CHECK 1..3`, `tags JSON`, `created_at`, `updated_at`, `archived_at NULL` |
| `pack_words` | `pack_id FK packs`, `word_id FK words`, `position CHECK >= 1`, `PK(pack_id, position)`, `UNIQUE(pack_id, word_id)` |
| `avatars` | `id PK`, `name`, `name_zh`, `color`, `pale`, `sort_order` |
| `avatar_stages` | `avatar_id FK avatars`, `stage`, `file`, `PK(avatar_id, stage)` |

Notes:

- `words.text` has a case-insensitive unique index; one row per headword.
- `part_of_speech` and the meanings are free text and may list several senses.
- `image` is null until artwork exists in R2; `emoji` is the transitional fallback.
- `sort_order` is not unique. Ordering is `(sort_order, id)`, so a reorder never needs a temporary
  duplicate value.
- `pack_words.position` is contiguous from 1 within a pack. Contiguity is enforced by the validator
  and the future admin write path, not by the database.
- There is no `word_topics`, `word_examples`, `artwork`, or unlock table. An unassigned word is
  allowed in master data but is not served.
- Content ids are immutable and never reused. Display text is editable; removal is
  `archived_at`, never a hard delete, so an in-flight commit can still name the row.

## Acceptance criteria

### Schema and migrations

- [ ] The generated foundation migration creates the content tables above with the declared keys,
      foreign keys, and check constraints, including the case-insensitive unique index on
      `words.text` and both `pack_words` constraints. It is produced by `drizzle-kit generate`,
      reviewed, and committed.
- [ ] The content-seed migration is the reviewed SQL authored for this sprint. It seeds topics,
      packs, words, `pack_words` rows, the unchanged 8 avatars × 5 stages, and `content_meta`. It is
      reviewed line by line and committed.
- [ ] `content_meta` is a single row with the current `schemaVersion`, `dataset: "dev"`, and the
      seeded `contentVersion`.
- [ ] Migrations apply cleanly to a fresh local D1 database with
      `wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc`, and re-running the
      apply is a no-op.
- [ ] The migration is idempotent only in the sense D1 requires: each file runs once. No
      `INSERT OR REPLACE` silently rewrites authored ids.
- [ ] Every content migration bumps `contentVersion`; the API's `ETag` and `/health` read it, so a
      stale edge cache is detectable.
- [ ] Content ids are additive: a migration never deletes or reuses a word, topic, or pack id.
      Removal is `archived_at`.
- [ ] `GET /health` now includes `contentVersion` read from `content_meta`; it stays public and
      `no-store`.

### Content API

- [ ] `GET /v1/content` returns `{ meta, topics, packs, words, avatars }`, with the same field names
      and value shapes the SPA already consumes.
- [ ] `topics` contains active topics only, ordered by `(sort_order, id)`; `Topic.packIds` is gone.
- [ ] `packs` contains the active packs of active topics; `Pack.wordIds` lists active words in
      `position` order; `Pack.unlockRule` is gone; `Pack.order` is `packs.sort_order`.
- [ ] `words` contains active words with at least one active pack membership, ordered by `id` so
      the bundle is stable. `Word.topicIds` is derived from the active packs that contain the word,
      ordered by topic `sort_order` then pack `sort_order`, and is never empty.
- [ ] A word with no active pack membership is omitted; a word whose only packs are archived is
      omitted with them.
- [ ] `Word.image` is a URL or `null`; the renderer falls back to `emoji`, then the first letter.
      The artwork manifest is gone.
- [ ] The response carries a strong `ETag` derived from `contentVersion`, `Cache-Control: public,
      max-age=300`, and CORS headers for the allowed origins.
- [ ] `If-None-Match` with the current ETag returns `304` with no body and the same cache headers;
      any other value returns `200`.
- [ ] The endpoint is public: no token is required, and a token is not rejected if present.
- [ ] A D1 failure returns `500 internal` in the error envelope; it never returns an empty bundle
      that a client could mistake for real content.

### Client content source

- [ ] `src/page/content/index.ts` stops importing JSON. It exposes `loadContent(bundle)` and keeps
      the existing read accessors (`getTopics`, `getPack`, `getWord`, `getAvatarSet`, `getAllWords`,
      and the rest) over a module-level frozen bundle.
- [ ] Accessors behave sensibly before a bundle is loaded (empty collections, `undefined` for a
      lookup) so the app can boot to a loading state instead of throwing.
- [ ] `getArtwork` is removed; `WordArtwork` resolves `Word.image`, then `emoji`, then the first
      letter.
- [ ] The session builder keeps working while the client still stores progress locally: with no
      introduction rows yet, it derives a per-pack "already introduced" set from existing progress,
      stamped with `firstSeenAt`. Feature 24 replaces that fallback with real rows from
      `/v1/me`.
- [ ] The static JSON files (`topics.json`, `packs.json`, `words.json`, `avatars.json`,
      `content-meta.json`, and `art/manifest.json`) and the tests that read them are deleted.
- [ ] `forbidden-terms.json`, `cambridge-allowlist.json`, `EXCEPTIONS.md`, and `REVIEW.md` move to
      `src/shared/content/rules/`, remain the authoring rules, and are never shipped in the client
      bundle. `pnpm extract:wordlist` points at the new allowlist path.
- [ ] `prebuild` and `validate:content` are removed from `package.json`, and CI stops calling them:
      they validated files that no longer exist. Their replacement is the D1 integrity test below.
- [ ] Artwork files stay at `src/page/public/art/` until R2 serves word images; the API stores only
      the URL.

### Content integrity gate

- [ ] A database-tier test assembles a bundle from the local D1 database using the same
      `src/worker/content.ts` mapping the route uses, and runs `validateContent` with
      `forbiddenTerms`.
- [ ] With `dataset = 'dev'` the test requires **zero errors**. Warnings are allowed only for the
      rules the validator marks editorial at `final`, and every warning is asserted by code and id so
      a new one cannot slip in silently.
- [ ] The same test asserts shape, not counts: every topic has at least one pack, every pack has at
      least one word, positions are contiguous from 1, every served word has at least one topic,
      every word has at least one example with both languages, levels are 1–3, `image` is null or an
      absolute URL, and avatars are 8 × 5 stages.
- [ ] The final-dataset run (`dataset = 'final'`, feature 17) requires zero errors and zero
      warnings; it is the release gate, not a build step.
- [ ] Content changes after this feature are authored as reviewed migration files; the validator
      runs against D1, not against a checked-in JSON snapshot.

### Remote D1 tier (gated)

- [ ] `pnpm test:db:remote` applies the migration set to a dedicated `words-wizard-test` database and
      asserts the constraints and shape a local run asserts.
- [ ] It reads `WORDS_TEST_CLOUDFLARE_API_TOKEN`, `WORDS_TEST_CLOUDFLARE_ACCOUNT_ID`, and
      `WORDS_TEST_D1_DATABASE_ID` — names distinct from any production credential — and **skips**
      with a visible summary when they are absent. It never touches the production database.
- [ ] A reachable test database that rejects a migration is a failure, not a skip: that is the bug
      the tier exists to find.

## API surface added

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | `{ ok, contentVersion }` |
| GET | `/v1/content` | public | `{ meta, topics, packs, words, avatars }`; ETag + `304` |

## Tasks (ordered)

1. Add the Drizzle content schema and generate the foundation migration.
2. Author the reviewed content-seed SQL: topics, packs, words, `pack_words`, avatars, stages, and
   `content_meta`. Review every row.
3. Apply both migrations to a fresh local D1, inspect `PRAGMA foreign_key_check`, and confirm the
   unique and check constraints refuse their bad cases.
4. Implement `src/worker/content.ts`: read the active rows, assemble the bundle, derive
   `topicIds`, parse the JSON columns at this boundary, and expose `contentVersion`.
5. Add `GET /v1/content` with ETag / `If-None-Match` handling and cache headers; extend `/health`.
6. Add the database-tier integrity test and the remote gated variant.
7. Rewrite `src/page/content/index.ts` around `loadContent(bundle)`; delete the JSON files and the
   JSON-reading tests; move the authoring rules to `src/shared/content/rules/`.
8. Remove `prebuild` / `validate:content` and their CI step; keep the build otherwise unchanged.
9. Rewrite [feature 17](17-content-production.md) for D1 authoring: migrations, review, the same
   validator, and the final gate.

## Tests

| Tier | What it proves |
|---|---|
| **Unit** (always) | Mapping from rows to `ContentBundle` (ordering, position order, derived `topicIds`, archived filtering, tags/examples JSON parsing, null image); ETag generation and `If-None-Match` decisions; content-version parsing. |
| **Model** (always) | Generated SQL declares the keys, check constraints (`level`, `json_valid(examples)`, `json_valid(tags)`), the case-insensitive unique index, the `pack_words` key and unique pair, and the foreign keys the docs claim; no table exists that the docs do not mention. |
| **Database / host** (local, always) | Migrations apply to a real D1; foreign keys reject a dangling word/topic/pack; the level and JSON checks reject out-of-set values; duplicate text collides case-insensitively; a duplicate position or duplicate word-in-pack collides; archived topics, packs, and words are excluded from the assembled bundle; the bundle passes `validateContent` with zero errors; the route returns the bundle, ETag, `304`, and cache headers; the run's database outlives the run. |
| **Remote** (gated) | The same migration set and constraints hold on Cloudflare's engine; skips visibly without test credentials. |
| **Manual** | `curl` on the deployed `/v1/content` shows the expected ETag and a `304` on revalidation; each topic renders its words and art. |

**RED-first hot spots**

- The integrity test and the migration before the seed exists: the validator must fail on an empty
  or partially seeded database for the expected reasons.
- ETag/`304` behaviour before the route implements it.
- The "no dangling reference" and archived-exclusion tests before the schema is declared final.

## Non-goals

- No content CMS, editor, admin API, or admin portal; the future portal is recorded in feature 17
  and scoped in the [Mission 3 sprint](00-mission-3-sprint.md).
- No R2 upload or image processing; `image` merely holds a URL.
- No new topics, words, or art beyond the reviewed seed; feature 17 owns authoring.
- No user data; feature 23 owns profiles, progress, introductions, and sessions.
- No client fetch wiring; feature 24 owns boot, caching, and the offline screen.
- No content deletion or id reuse, ever, in a migration.
