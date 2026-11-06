# Feature 30 — Word Library and Pack Membership

> Priority: Must · Mission 3 · **Status: Implemented**
> Depends on: 28 (portal foundation), 29 (topics and packs). Blocks: 31.
> Source of truth: [Mission 3 sprint](00-mission-3-sprint.md) and the
> [portal UI brief](../../../Portal.md).

## Summary

Give teachers the word library: the master records every pack draws from, plus the ordered
membership that decides which words a child meets in a pack and in what order.

Words are shared. One word row can appear in many packs across many topics, and editing it changes
every appearance. That is why **words are never deleted or archived**: removing a word from every
pack hides it from children while it stays available in the library for later use.

## User story

As a **teacher**, I add a new word once — bilingual meanings, definitions, examples, level, tags,
emoji — then place it into any packs that should teach it. I reorder a pack so its words build
naturally, and I remove a word from a pack without touching the other packs that use it.

## Design

### Word records

Every word carries: English headword, phonetic, part of speech, English and Chinese meanings,
English and Chinese definitions, one or more bilingual examples, level 1–3, free-form tags, an
emoji, and an optional image. The generated id is `w-<slugify(headword)>`, read-only, suffixed on
collision across active and archived rows, and never reused.

- `POST /v1/admin/words` creates a word; an optional `packId` adds it to that pack in the same
  atomic batch, so “create a word here” is one action.
- `PATCH /v1/admin/words/:id` edits the record. The id never changes. The headword is unique
  case-insensitively across all words, archived included; a collision is reported as a content
  conflict, not a server error.
- There is no delete route and no archive route. The portal exposes no such control.
- `image` is not accepted by create or edit; it is written only by feature 31's upload route.

### Pack membership

- `PUT /v1/admin/packs/:id/membership` takes the full ordered list of word ids and replaces the
  pack's membership. Positions are always `1..N`, contiguous.
- The replace is a delete followed by an insert in one atomic batch: the `(pack_id, position)`
  primary key makes in-place reordering impossible, and a partial renumber must never be visible.
- Validation: no duplicate ids; every word exists and is not archived; the pack and its topic are
  not archived; the list length is bounded.
- Edits to membership bump the pack's `updated_at` and the content version.

### Portal

- The **Words** screen is a searchable master list: English headword, Chinese meaning, phonetic,
  level, and “used in N packs”. Words in no pack are marked “Not in any pack — hidden from
  children”.
- The **word editor** edits the bilingual record, the examples repeater, level, tags, and emoji;
  it shows the read-only id. No delete or archive control exists.
- The **pack contents** screen is an ordered working draft: add words from a search dialog,
  remove, and reorder. **Save changes** commits the whole list; **Discard changes** abandons it.
  Leaving with unsaved changes asks for confirmation.
- Every save is live for children immediately; the interface says so in context.

## Acceptance criteria

- [x] A word can be created and edited; all bilingual fields, examples, level, tags, and emoji
      round-trip.
- [x] The word id is derived from the headword, read-only, collision-suffixed, and never reused.
- [x] A duplicate headword, case-insensitive and including archived rows, is rejected with a clear
      conflict message and nothing written.
- [x] No portal screen or route deletes or archives a word.
- [x] A word can be added to several packs across topics; editing it changes every appearance.
- [x] Removing a word from every pack hides it from `/v1/content` but keeps it in the admin
      snapshot and the library.
- [x] Pack membership saves as a full ordered replace with positions `1..N`; `/v1/content` serves
      the same order.
- [x] Duplicate ids, unknown words, archived words, and an archived pack are rejected; nothing is
      written.
- [x] Create-with-pack places the word in the pack atomically.
- [x] Every accepted change bumps the content version; rejections do not.

## Test plan

- **Worker unit** — word and membership input parsing at the boundary values (example count, tag
  count, list length, level), unknown-field rejection, id derivation.
- **Host tier** — `src/worker/test/admin.test.ts`: create/edit word; duplicate headword conflict;
  membership add/remove/reorder reflected in `/v1/content`; all-membership removal hides the word;
  archived pack rejection; version bump per accepted change.
- **Database tier** — extend `src/worker/test/database.test.ts`: `(pack_id, position)` primary key
  under delete-and-insert; `(pack_id, word_id)` uniqueness; case-insensitive headword index.
- **Manual** — words library and pack contents flows in the portal; unsaved-changes prompt.

## Documentation impact

`docs/develop/worker.md` (word and membership routes, conflict semantics),
`docs/develop/portal.md` (screens), PRD (shared-word model).

## Out of scope

Word images and emoji upload (feature 31); word deletion or archival; bulk import/export;
release and drafts; audit history.
