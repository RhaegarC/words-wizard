# Feature 04 — Content Layer & Validation

> Priority: Must · Mission 1 · **Status: Not started**
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

- [ ] `content/topics.json`, `content/packs.json`, `content/words.json` exist at the root in the
      v0.2 schema (PRD §6.4, §6.5).
- [ ] `content/avatars.json` declares 3 avatars (`luma`, `pippin`, `moss`) × 5 stages, each with an
      image path.
- [ ] `content/art/manifest.json` maps every word id to `{ "file": "art/<word>.webp",
      "status": "approved" | "placeholder" }`.
- [ ] `content/content-meta.json` declares `{ "schemaVersion": 1, "dataset": "dev" | "final",
      "contentVersion": "x.y.z" }`.
- [ ] The data-access module exports `getTopics`, `getTopic`, `getPacksByTopic`, `getPack`,
      `getWord`, `getWordsByIds`, `getWordsByTopic`, `getAvatarSet`, `getArtwork`, and
      `getContentMeta`. No screen imports a JSON file directly.
- [ ] Content is imported statically (Vite bundles it) and never fetched at runtime.
- [ ] `pnpm validate:content` checks every rule below and exits non-zero with file + id + rule on
      failure.
- [ ] A missing or `placeholder` artwork file and a `wordId` with no authored record are **warnings**
      in `dataset: "dev"` and **errors** in `dataset: "final"`.
- [ ] Pack unlock values are exactly `0`, `15`, `30`.
- [ ] The dev dataset contains **20 fully bilingual words** in topic 1, pack 1, with images (real or
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
7. Every `image` path exists in `public/` (or `content/art/`), and the manifest has a matching entry.
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
5. Write the `scripts/validate-content.ts` runner (`tsx`) and the `validate:content` script; print
   a grouped report.
6. Write the data-access module `src/content/index.ts`; freeze the returned arrays so a screen cannot
   mutate content.
7. Add the artwork resolver: real file when available, styled placeholder tile otherwise; the
   placeholder renders an emoji from `word.emoji` or the word's initial.
8. Add the forbidden-term JSON list and the abstract-word tag check.
9. Wire `validate:content` into `pnpm build` (prebuild) and CI (feature 16).
10. Add a fixture-based test for every rule (one failing fixture per rule, plus one valid bundle).

## Tests

**Unit (Vitest), each rule driven by fixtures:**

- Valid bundle produces zero issues.
- Each rule produces exactly its issue code for the failing fixture: slot count, duplicate id,
  dangling reference, bad level, empty bilingual field, unpaired example, example missing the word,
  missing image, forbidden term, bad unlock value, placeholder art in `final`, missing abstract word.
- Data access: lookup by id, packs by topic in `order`, words by topic, unknown id returns
  `undefined` rather than throwing.
- Artwork resolver: approved file wins; placeholder is returned for a missing file in `dev`.

**Verification:**

- `pnpm validate:content` on the dev dataset reports the expected incompleteness for the 14 packs
  that are not authored, and exits 0 for the dev dataset.
- Set `dataset` to `final` and confirm the command fails with the missing-slot count.

## Non-goals

- No CMS, no runtime content fetch, no content editor.
- No full 300-word authoring (feature 17).
- No final illustrations (feature 17).
