# Feature 17 — Content Production: D1 Vocabulary Authoring

> Priority: Must (release blocker) · Mission 2 · **Status: In progress — early content authored;
> teacher review and the D1 move pending**
> Depends on: 04 (schema rules), 22 (D1 content store and validator hook). Authoring can continue in
> parallel; the final gate runs against D1.
>
> **Mission 2 update:** authoring moves from bundled JSON to versioned D1 migrations in
> [feature 22](22-d1-content-store.md). The validator and review gates below stay; the
> `src/content/` file paths and the `pnpm validate:content` loop are Mission 1's and are replaced by
> the database integrity gate. **Do not author into JSON.** New words are written once, directly
> into D1. See the [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Author the actual product. Feature 04 ships the contract; this feature fills the D1 vocabulary
tables with bilingual, Cambridge-allowlisted words, assigns them to day-sized packs inside topics,
produces and reviews word images, has a Chinese-speaking English teacher review all of it, and flips
`content_meta.dataset` to `final`.

Topics are the categories the offline word list uses — Animals, The body and the face, Clothes,
Colours, Family & friends, Food & drink, Health, Numbers, The home, Materials, Names, Places &
directions, and School. Packs are the sub-categories within a topic. A pack is day-sized at about
five words but has no fixed size; a longer pack spans several days, and the session builder takes
the next five unintroduced words.

There is no fixed topic, pack, or word count. Coverage and quality are editorial decisions; the
validator checks shape and, at `final`, completeness.

This is authoring work, not runtime code. Its tests are the content validator and the documented
sign-off.

The Cambridge allowlist is generated once from the source PDF and committed as
`src/shared/content/rules/cambridge-allowlist.json` (`pnpm extract:wordlist`, 1,343 headwords with
band, part of speech, variants, and notes). The PDF is never parsed at runtime or in CI.

`docs/sample_data/vocab.json` is reference input for the topic categories and headword list, not the
seed format. It is not imported by the build, tests, or migrations.

## User story

As a **child**, every word I meet has a picture, a Chinese meaning, a simple definition, and an
example I can understand. As a **parent/teacher**, the vocabulary is level-appropriate, real-world
useful, and free of game-brand references. As a **content author**, I add a word or a pack through a
reviewed migration, not by editing a bundled file.

## Acceptance criteria

### Words

- [ ] One row per headword. `words.text` is unique case-insensitively; a second sense is written in
      the existing row's free-text `part_of_speech`, meanings, and definitions, not as a second row.
- [ ] Every word is in the Cambridge Starters/Movers/Flyers 2025 list, or carries a documented
      exception approved by the content lead in `src/shared/content/rules/EXCEPTIONS.md`.
- [ ] Level `1 | 2 | 3` matches the word's Cambridge band (Starters/Movers/Flyers), not its pack
      order.
- [ ] Each release topic has an editorial spread of core and thematic words, at least one
      abstract/emotional word, and each pack's final third includes an abstract word tagged
      `abstract`. The mix is reviewed, not counted by the validator at `dev`; at `final` the abstract
      rule is an error.
- [ ] Every record has non-empty `text`, `phonetic` (IPA), `part_of_speech`, `meaning_en`,
      `meaning_zh`, `definition_en`, `definition_zh`, and at least one example with both `en` and
      `zh`.
- [ ] The **first English example contains the target word** on a word boundary, in a natural
      sentence, because fill-the-blank extracts it. This is an editorial rule, enforced at `final`.
- [ ] No forbidden terms (game names, logos, characters, or game-specific slang) anywhere.
- [ ] A Chinese-speaking English teacher has reviewed every record for level, natural English,
      natural Chinese, and age-appropriateness; sign-off is recorded in
      `src/shared/content/rules/REVIEW.md` by topic and pack with reviewer and date.
- [ ] Every word intended for release belongs to at least one active pack. Unassigned words are
      allowed in master data but are excluded from `GET /v1/content`.

### Artwork

- [ ] Each word's `image` is an absolute URL to a reviewed image in R2, or `null` while art is
      pending. A null image renders `emoji`, then the first letter; `emoji` is transitional.
- [ ] Each image is WebP, ~512 px on the long edge, ~20–40 KB, with a transparent or consistent
      background per the art style guide.
- [ ] Every image has been human-reviewed for recognisability at small size, cultural neutrality,
      and age-appropriateness. Approval is tracked by the future admin layer, not by a column in the
      public vocabulary schema.
- [ ] The 8 avatars × 5 stages remain complete and are unchanged by this feature; stage art reads as
      growth (Egg → Hatchling → Juvenile → Adult → Legendary) and is distinguishable at 96 px.
- [ ] Total client-side artwork stays within the **10–15 MB** target; R2 images are measured at
      their served size.

### Release gate

- [ ] `content_meta` has `dataset: "final"` and a bumped `contentVersion`.
- [ ] The database integrity test assembles the bundle from D1 and runs `validateContent` with zero
      errors and zero warnings.
- [ ] Speech spot-check: every word is pronounced intelligibly by an `en-*` voice on iPad Safari and
      Edge; any word that is ambiguous (homographs, abbreviations) is rewritten or given a
      pronunciation note.
- [ ] `pnpm build` + `check:dist` include the remaining bundled art; the service worker precache
      manifest is correct for R2 image URLs.
- [ ] A native-speaker read-through of 30 random records finds no meaning/definition mismatch.

## Tasks (ordered)

1. Finalise the topic list and topic metadata (immutable slug, bilingual title, icon, description,
   `sort_order`) from the offline categories. Reserve ids before authoring so references never move.
2. Group each topic into packs of about five words (a day's session). A pack may be larger; write
   `sort_order` and reserve pack ids.
3. Select words from `cambridge-allowlist.json`, assign their Cambridge level, and reserve word ids.
   Keep the level with the word, not with its pack order.
4. Author the bilingual records: IPA, part of speech, glosses, kid-friendly definitions, paired
   examples; run the fill-the-blank check on every first example.
5. Teacher review by topic and pack; fix and record sign-off in `REVIEW.md`.
6. Produce and review word images; upload to R2 and record the URL in `words.image`, or leave null
   with `emoji` while art is pending.
7. Write the seed as reviewed SQL migration rows: `topics`, `packs`, `words`, `pack_words`, and the
   `content_meta` version bump. Review every row; no generated prose enters the migration.
8. Apply to a local D1 and run the database integrity test at `dev`; fix every error.
9. Speech spot-check and native read-through; fix and re-validate.
10. Flip `dataset` to `final`, bump `contentVersion`, run the gate with zero errors and zero
    warnings, and hand the release to feature 25.

## Tests

**Content integrity gate (real, not a fixture):**

- The database-tier test from feature 22 assembles the bundle and runs `validateContent` with
  `dataset: "final"` — zero errors, zero warnings: unique ids and case-insensitive text, resolving
  pack/topic/word references, every pack non-empty with contiguous positions, every served word has
  a topic, levels 1–3, bilingual completeness, paired examples, first-example-contains-word, image
  URL shape, forbidden terms, and abstract-word coverage.

**Doc assertions:**

- `src/shared/content/rules/REVIEW.md` has a row for every topic and pack, each with a reviewer and
  a date.
- `src/shared/content/rules/EXCEPTIONS.md` lists every word outside the allowlist with its
  approval.

**Verification (manual):**

- Open every topic and pack in the app; every word renders its image or emoji fallback, IPA, Chinese
  meaning, and example.
- Run a session in each topic; no blank tile appears; the next pack unlocks only after the previous
  pack is fully introduced.
- 30-record read-through and the speech spot-check are recorded in `REVIEW.md`.

## Non-goals

- No phrases or sentences (Phase 3), no recorded audio.
- No content CMS, editor, or admin API in this sprint. A future admin portal for teachers/admins
  replaces hand-written SQL; artwork approval belongs to that layer. It is scoped in the
  [Mission 3 sprint](00-mission-3-sprint.md).
- No hard-coded topic, pack, or word counts; coverage is an editorial decision.
- No image generation at runtime or in CI.
