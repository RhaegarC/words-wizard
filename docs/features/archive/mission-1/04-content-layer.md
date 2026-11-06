# Feature 04 — Content Layer & Validation

> Priority: Must · Mission 1 · **Status: Done — merged in PR #9**
> Depends on: 01

## Summary

Define where words, topics, packs, avatars, and artwork live; load them as bundled read-only JSON
behind one data-access module; and make the content contract executable. The validator is the thing
that stops a half-authored pack from shipping, and it runs in `pnpm build`/CI, not only in a test.

The real 300 words are feature 17's job. This feature ships the schema, the loader, the validator,
a **dev dataset** (one fully authored pack) and placeholder artwork, so features 06–14 can be built
against real bilingual records.

## User story

As a **developer**, I can ask for the topics, a pack, or a word by id without knowing how content is
stored, and I cannot merge content that breaks the contract. As a **content author**, I get a precise
list of what is wrong with a pack before anyone plays it.

## Acceptance criteria

- [x] `src/content/topics.json`, `src/content/packs.json`, `src/content/words.json` exist in the
      v0.2 schema (PRD §6.4, §6.5).
- [x] `src/content/avatars.json` declares 3 avatars (`luma`, `pippin`, `moss`) × 5 stages, each with
      an image path.
- [x] `src/content/art/manifest.json` maps every word id to `{ "file": "art/<word>.webp",
      "status": "approved" | "placeholder" }`.
- [x] `src/content/content-meta.json` declares `{ "schemaVersion": 1, "dataset": "dev" | "final",
      "contentVersion": "x.y.z" }`.
- [x] The data-access module exports `getTopics`, `getTopic`, `getPacksByTopic`, `getPack`,
      `getWord`, `getWordsByIds`, `getWordsByTopic`, `getAvatarSet`, `getArtwork`, and
      `getContentMeta`. No screen imports a JSON file directly.
- [x] Content is imported statically (Vite bundles it) and never fetched at runtime.
- [x] `pnpm validate:content` checks every rule below and exits non-zero with file + id + rule on
      failure.
- [x] A missing or `placeholder` artwork file and a `wordId` with no authored record are **warnings**
      in `dataset: "dev"` and **errors** in `dataset: "final"`.
- [x] Pack unlock values are exactly `0`, `15`, `30`.
- [x] The dev dataset contains **20 fully bilingual words** in topic 1, pack 1, with images (real or
      placeholder) and paired examples, and is enough to run a 9-word session plus reviews.

### Validation rules

1. Exactly 5 topics, 3 packs per topic, 20 `wordIds` per pack (slots may repeat a word id).
2. Topic, pack, and word ids are unique; every `topicIds`/`packIds` reference resolves. In `final`,
   every `wordIds` entry resolves; in `dev`, an unresolved word id is reported as a warning.
3. Every word level is `1 | 2 | 3`; the level matches the documented Cambridge band.
4. `text`, `phonetic`, `partOfSpeech`, `meaningEn`, `meaningZh`, `definitionEn`, `definitionZh`
   are non-empty.
5. Every example has non-empty `en` and `zh`.
6. The first English example contains the target word, case-insensitively and on a word boundary —
   feature 08's fill-the-blank depends on it.
7. Every `image` path exists in `src/public/` (or `src/content/art/`), and the manifest has a
   matching entry.
8. No forbidden IP terms (game names, logos, characters, slang) in any word or topic field; the term
   list is data, not code.
9. Pack `order` is `1..3` within a topic and unique.
10. `dataset: "final"` additionally requires: all 5 × 3 × 20 slots resolve to valid words, at most
    300 distinct word records (cross-topic sharing is allowed), and no `placeholder` art.
11. Every word has at least one English example and one Chinese translation.
12. Topic mix: each topic has ≥ 1 abstract/emotional word, and within each pack the final third
    includes at least one abstract/emotional word (checked via the `tags` marker `abstract`).

## Tasks (ordered)

1. Define the content schema types (reuse `src/domain/types.ts`) and a `ContentBundle` type.
2. Create the JSON skeletons: 5 topics, 15 packs, empty/partial word list, avatars, art manifest,
   content-meta with `dataset: "dev"`.
3. Author the dev dataset: 20 bilingual words for topic 1 / pack 1, with a concrete → abstract arc,
   paired examples, and the first example containing the target word.
4. Write the pure validator in `src/domain/content/validate.ts`; return structured issues, never
   throw on the first failure.
5. Write the `src/scripts/validate-content.ts` runner (`tsx`) and the `validate:content` script; print
   a grouped report.
6. Write the data-access module `src/content/index.ts`; freeze the returned arrays so a screen cannot
   mutate content.
7. Add the artwork resolver: real file when available, styled placeholder tile otherwise; the
   placeholder renders an emoji from `word.emoji` or the word's initial.
8. Add the forbidden-term JSON list and the abstract-word tag check.
9. Wire `validate:content` into `pnpm build` (prebuild) and CI (feature 16).
10. Add a fixture-based test for every rule (one failing fixture per rule, plus one valid bundle).

## Implementation notes

- `src/domain/content/types.ts` — `ContentBundle`, `Avatar`, `ArtworkEntry`, `ContentMeta`, and
  the issue-code union.
- `src/domain/content/validate.ts` — the pure validator. It returns every issue (file, id, code,
  severity); severity for unresolved slots and artwork follows the dataset.
- `src/domain/content/artwork.ts` — `resolveArtwork`, which prefers approved art and otherwise
  returns an emoji or initial placeholder.
- `src/content/index.ts` — the only module that imports content JSON; every collection is
  deep-frozen and returned as `readonly`.
- `src/content/forbidden-terms.json` — the IP term list is data.
- `src/scripts/validate-content.ts` — CLI runner; injects filesystem checks for art and prints a
  grouped report. `tsx` is a dev dependency.
- `package.json` — `validate:content` and a `prebuild` hook, so `pnpm build` cannot package invalid
  content.
- `src/components/WordArtwork.tsx` — renders approved art or the placeholder tile.
- Level range (`1 | 2 | 3`) is executable; matching each word to its Cambridge band is part of the
  authoring review (feature 17), because the allowlist is a PDF.

## Tests

**Unit (Vitest):** 89 tests pass across 12 files; 40 are new for this feature.

- `domain/content/validate.test.ts` — 24 fixture-driven tests: a valid dev and a valid final
  bundle produce zero issues; each rule's failing fixture produces its code (topic/pack/slot
  counts, duplicate id, unresolved references, level, empty field, missing/unpaired examples,
  example omitting the target, manifest and file gaps, forbidden term, unlock, order, >300 words,
  abstract mix, avatar count and stages). Severity is asserted for unresolved slots and artwork in
  both datasets.
- `content/index.test.ts` — topic and pack lookup, pack order, word lookup by id and by topic,
  unknown ids returning `undefined`, avatars, artwork, metadata, and frozen collections.
- `domain/content/artwork.test.ts` — approved art wins; placeholder entries, missing entries, and
  missing emoji fall back correctly; absolute paths are untouched.

**Verification:**

- `pnpm validate:content` on the dev dataset exits 0 with 300 warnings: 280 unresolved slots across
  the 14 unauthored packs and 20 missing placeholder art files.
- Temporarily setting `dataset` to `final` makes the same command exit 1 with 300 errors,
  including every unresolved slot; the file was restored afterwards.
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; `prebuild` runs the validator.

## Non-goals

- No CMS, no runtime content fetch, no content editor.
- No full 300-word authoring (feature 17).
- No final illustrations (feature 17).
