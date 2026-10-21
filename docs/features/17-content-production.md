# Feature 17 — Content Production: 300 Words & 315 Illustrations

> Priority: Must (release blocker) · Mission 1 · **Status: In progress — Craft & Build pilot authored; teacher review pending**
> Depends on: 04 (schema and validator). Authoring can run in parallel from feature 04; it must land
> before any public release.

## Summary

Author the actual product. Feature 04 ships the contract and a 20-word dev pack; this feature fills
5 topics × 3 packs × 20 slots with bilingual, Cambridge-allowlisted words, produces 300 word
illustrations and 15 avatar-stage illustrations, has a Chinese-speaking English teacher review all of
it, and flips `content-meta.json` to `dataset: "final"`.

This is authoring work, not runtime code. Its tests are the content validator and the documented
sign-off.

The Cambridge allowlist is generated once from the source PDF and committed as
`src/content/cambridge-allowlist.json` (`pnpm extract:wordlist`, 1,343 headwords with band, part of
speech, variants, and notes). The PDF is never parsed at runtime or in CI.

## User story

As a **child**, every word I meet has a picture, a Chinese meaning, a simple definition, and an
example I can understand. As a **parent/teacher**, the vocabulary is level-appropriate, real-world
useful, and free of game-brand references.

## Acceptance criteria

### Words

- [ ] Exactly 5 topics × 3 packs × 20 slots = **300 slots**, all resolving to authored words; at most
      300 distinct records (cross-topic sharing allowed and documented).
- [ ] Every word is in the Cambridge Starters/Movers/Flyers 2025 list, or carries a documented
      exception approved by the content lead in `src/content/EXCEPTIONS.md`.
- [ ] Level `1 | 2 | 3` matches the word's Cambridge band (Starters/Movers/Flyers), not its pack order.
- [ ] Per topic: ~80% core useful words, ~20% thematic flavour words; at least one abstract/emotional
      word; each pack runs concrete → abstract and its final third includes an abstract word tagged
      `abstract`.
- [ ] Every record has non-empty `text`, `phonetic` (IPA), `partOfSpeech`, `meaningEn`, `meaningZh`,
      `definitionEn`, `definitionZh`, and at least one example with both `en` and `zh`.
- [ ] The **first English example contains the target word** on a word boundary, in a natural
      sentence, because fill-the-blank extracts it.
- [ ] No forbidden terms (game names, logos, characters, or game-specific slang) anywhere.
- [ ] A Chinese-speaking English teacher has reviewed every record for level, natural English,
      natural Chinese, and age-appropriateness; sign-off is recorded in `src/content/REVIEW.md` by
      topic and pack with reviewer and date.

### Artwork

- [ ] **One illustration per distinct word record** (≈300; a cross-topic shared word reuses one
      image), plus **15 character images** (3 avatars × 5 stages) — **315 at the target of 300
      distinct words**.
- [ ] Each image is WebP, ~512 px on the long edge, ~20–40 KB, with a transparent or consistent
      background per the art style guide.
- [ ] Every image has been human-reviewed for recognisability at small size, cultural neutrality, and
      age-appropriateness; the manifest status is `approved`, not `placeholder`.
- [ ] Avatar stage art reads as growth (Egg → Hatchling → Juvenile → Adult → Legendary) for all three
      avatars, and each stage is distinguishable at 96 px.
- [ ] Total precached artwork stays within the **10–15 MB** target; measured on a real build.

### Release gate

- [ ] `content-meta.json` has `dataset: "final"` and a bumped `contentVersion`.
- [ ] `pnpm validate:content` passes with zero errors and zero warnings.
- [ ] Speech spot-check: every word is pronounced intelligibly by an `en-*` voice on iPad Safari and
      Edge; any word that is ambiguous (homographs, abbreviations) is rewritten or given a
      pronunciation note.
- [ ] `pnpm build` + `check:dist` include all 315 images; the service worker precache manifest lists
      them.
- [ ] A native-speaker read-through of 30 random records finds no meaning/definition mismatch.

## Tasks (ordered)

1. Build the slot skeleton: 5 topics × 3 packs × 20 word ids, with cross-topic shared ids marked;
   reserve ids before authoring so pack references never move. Select each word from
   `content/cambridge-allowlist.json` and keep its `level`.
2. **Topic 1 — Craft & Build:** select 60 words (≈48 core, ≈12 flavour) from the allowlist, assign
   Cambridge levels, place abstract words at pack ends, and write 3 packs.
3. Author the 20 bilingual records for each pack: IPA, part of speech, glosses, kid-friendly
   definitions, paired examples; run the fill-the-blank check on every first example.
4. Teacher review of topic 1; fix and record sign-off.
5. **Topic 2 — Explore & Discover:** repeat steps 2–4.
6. **Topic 3 — Puzzle & Mystery:** repeat steps 2–4.
7. **Topic 4 — Co-op Quest:** repeat steps 2–4.
8. **Topic 5 — Battle & Survive:** repeat steps 2–4.
9. Produce the art style guide and prompt sheet (one subject per word, no text in image, consistent
   palette); generate one image per distinct word record (≈300) in batches.
10. Human review of every word image at 96 px and 512 px; regenerate rejects; convert to WebP and add
    to `src/content/art/`.
11. Produce and review the 15 avatar-stage images.
12. Update `src/content/art/manifest.json` to `status: "approved"` for every record and confirm the
    validator's image-existence rule.
13. Run `pnpm validate:content`, fix every error and warning; confirm no dangling references and no
    placeholders.
14. Speech spot-check and native read-through; fix and re-validate.
15. Flip `dataset` to `final`, bump `contentVersion`, and hand the release gate to feature 16.

## Tests

**Content validator (real, not a fixture):**

- `pnpm validate:content` with `dataset: "final"` — zero errors, zero warnings: slot counts, unique
  ids, resolved references, levels, bilingual completeness, paired examples, first-example-contains-
  word, image existence, forbidden terms, unlock values, abstract-word mix.

**Doc assertions:**

- `src/content/REVIEW.md` has a row for every topic and pack, each with a reviewer and a date.
- `src/content/EXCEPTIONS.md` lists every word outside the allowlist with its approval.
- `src/content/art/manifest.json` has one entry per distinct word record (≈300) and 15 avatar entries,
  all `approved`.

**Verification (manual):**

- Open every topic and pack in the app; every word renders its image, IPA, Chinese meaning, and
  example.
- Run a session in each topic; no placeholder tile appears.
- `du` / `storage.estimate()` confirms the total artwork size.
- 30-record read-through and the speech spot-check are recorded in `REVIEW.md`.

## Non-goals

- No phrases or sentences (Phase 3), no recorded audio.
- No content CMS or editor.
- No extra topics beyond the five (Phase 2 adds more).
