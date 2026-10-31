# Content Review

Feature 17 requires a Chinese-speaking English teacher to read every record for
level, natural English, natural Chinese, and age-appropriateness before the
dataset can be marked `final`. This file records that sign-off.

> **Retired on 2026-10-30.** The entries below are sign-offs for the Mission 1 JSON pilot
> (Craft & Build, Explore & Discover). Those records were never moved to D1, and the current
> topic model does not include those topics. **No row in this file approves a D1 vocabulary
> row.** When feature 17 authors D1 content, replace this record with sign-offs for the new
> topics and packs.

**Craft & Build was reviewed and signed off in the retired JSON pilot. Explore &
Discover was authored but not reviewed.** The old `content-meta.json` was never moved to D1;
do not mark anything `final` until every authored D1 pack has a reviewer and a date.

## Craft & Build scope

- **Topic:** Craft & Build (`craft-and-build`)
- **Packs:** `craft-1` My Workshop, `craft-2` Materials & Making, `craft-3`
  Making & Feeling
- **Words:** 60 distinct records, 48 tagged `core` and 12 tagged `thematic`
  (80/20). `core` means useful beyond the craft table (everyday objects,
  actions, and feelings); `thematic` means the word is craft-specific
  (specialist materials, tools, or making verbs). Every headword is a single
  word from `cambridge-allowlist.json` at its Cambridge band; no exceptions are
  needed, so there is no `EXCEPTIONS.md` entry to review.
- **Shape:** each pack runs concrete → abstract, and its final third contains a
  word tagged `abstract`.
- **Artwork:** every record has a manifest entry marked `placeholder`. The 60
  illustrations and the 15 avatar stages still need to be produced and
  approved.

## Explore & Discover scope

- **Topic:** Explore & Discover (`explore-and-discover`)
- **Packs:** `explore-1` Wild Places, `explore-2` Finding the Way, `explore-3`
  Curious Minds
- **Words:** 60 distinct records, 48 tagged `core` and 12 tagged `thematic`
  (80/20). Every headword is a single word from `cambridge-allowlist.json` at
  its Cambridge band; no exceptions are needed.
- **Shape:** each pack runs concrete → abstract, and its final third contains a
  word tagged `abstract`.
- **Artwork:** every record has a manifest entry marked `placeholder`. The 60
  illustrations still need to be produced and approved.

## Review record

| Topic | Pack | Reviewer | Date | Status |
| --- | --- | --- | --- | --- |
| Craft & Build | `craft-1` My Workshop | Rhaegar Cheng | 2026-10-22 | Reviewed |
| Craft & Build | `craft-2` Materials & Making | Rhaegar Cheng | 2026-10-22 | Reviewed |
| Craft & Build | `craft-3` Making & Feeling | Rhaegar Cheng | 2026-10-22 | Reviewed |
| Explore & Discover | all packs | — | — | Authored — review pending |
| Puzzle & Mystery | all packs | — | — | Not authored |
| Co-op Quest | all packs | — | — | Not authored |
| Battle & Survive | all packs | — | — | Not authored |

## What the reviewer is checking

1. `level` matches the child's Cambridge band (Starters 1, Movers 2, Flyers 3).
2. The English definition is simple enough for that band and does not lean on a
   harder word than the target.
3. The Chinese meaning and definition are natural Mandarin for a child, not a
   literal translation.
4. Both examples are natural, age-appropriate, and the first one contains the
   target word (fill-the-blank depends on it).
5. The word is useful for the topic and the concrete → abstract progression
   reads correctly.

Record the reviewer's name and the review date in the row when the pack is
complete. A row may only move to `Reviewed` when every word in that pack has
been read.
