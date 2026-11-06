# Feature 29 — Topics and Packs Admin

> Priority: Must · Mission 3 · **Status: Implemented**
> Depends on: 28 (portal foundation). Blocks: 30.
> Source of truth: [Mission 3 sprint](00-mission-3-sprint.md) and the
> [portal UI brief](../../../Portal.md).

## Summary

The first write surface: create, edit, order, archive, and restore topics and packs from the
portal. This feature also establishes the write mechanics every later admin feature reuses — input
validation, the shared validator, generated ids, the content-version bump, and atomic batches.

Topics and packs are the structural skeleton of the vocabulary. A topic contains packs; a pack
contains words (membership arrives in feature 30). Archiving a topic hides it and everything under
it from children without deleting a row.

## User story

As a **teacher**, I create a topic for a new area of interest, add packs under it, put them in the
order children should meet them, and archive a pack that is no longer used — then restore it next
term if I need it back. Every change is live for children as soon as I save.

## Design

### Shared write mechanics

- **Generated ids.** `slugify` lowercases ASCII, folds diacritics, collapses non-alphanumerics to
  `-`, caps length, and falls back to a numeric prefix for non-Latin input. A collision gets
  `-2`, `-3`, … across active **and archived** rows. Ids are shown read-only and never reused.
  Topic id: `slugify(title)`. Pack id: `<topicId>-<n>`, where `n` is the smallest positive number
  unused by that topic's packs, archived included.
- **Timestamps** are server milliseconds: `created_at = updated_at = now` on create;
  `updated_at = now` on every accepted change.
- **Every accepted change bumps `content_meta.content_version`**, in the same atomic batch as the
  row write, so the public `ETag` changes exactly when content does. A rejected or no-op change
  does not bump it.
- **Validation before writing.** The proposed change is applied to the loaded content in memory and
  run through the shared validator. Structural errors reject with the full issue list and nothing
  is written; editorial warnings are returned but do not block while `dataset` is `dev`. Because
  the editor is incremental, `topic-no-packs` and `pack-no-words` are downgraded to warnings — a
  teacher must be able to create an empty topic and fill it afterwards.
- **Concurrency.** Requests carry the snapshot's content version; a stale version is rejected as a
  conflict and the portal refetches. Two tabs therefore cannot silently overwrite each other.

### Routes

All under the feature 28 role boundary.

| Method | Path | Effect |
|---|---|---|
| POST | `/v1/admin/topics` | create; id derived |
| PATCH | `/v1/admin/topics/:id` | edit bilingual title, icon, descriptions |
| POST | `/v1/admin/topics/:id/archive` / `restore` | flip `archived_at` |
| PUT | `/v1/admin/topics/order` | renumber `sort_order` 1..N |
| POST | `/v1/admin/packs` | create under a topic |
| PATCH | `/v1/admin/packs/:id` | edit bilingual title; topic is immutable |
| POST | `/v1/admin/packs/:id/archive` / `restore` | flip `archived_at` |
| PUT | `/v1/admin/packs/order` | renumber within a topic |

### Behaviour

- Archive is soft: only the selected row's `archived_at` changes. A pack under an archived topic
  keeps `archivedAt: null` but is hidden by its ancestor; the UI labels it so.
- Archived topics and packs remain in the admin snapshot and appear in the **Archived** view with
  a restore action.
- Editing an archived row is refused; restore it first.
- Archive and restore are no-ops when the row is already in the requested state, and a no-op does
  not bump the content version.
- **Portal screens:** topics list, topic editor, packs list within a topic, pack editor, and the
  Archived view, as specified in `docs/Portal.md`.

## Acceptance criteria

- [x] A topic can be created with bilingual title, icon, and descriptions; its id is derived and
      read-only.
- [x] A pack can be created under a topic; its id is `<topicId>-<n>` and skips numbers used by
      archived packs.
- [x] Duplicate names do not collide ids; the suffix rule applies.
- [x] Topics and packs can be edited; generated ids never change.
- [x] Reordering writes contiguous `sort_order` and the child app sees the new order.
- [x] Archiving a topic hides it, its packs, and its words from `/v1/content`; restoring returns
      them.
- [x] Archiving a pack hides only that pack; its words stay in the library.
- [x] Archived rows are listed for restore and refused for edit.
- [x] Every accepted change bumps the content version; a rejected change writes nothing and bumps
      nothing.
- [x] Structural validation failures return the issue list; editorial warnings do not block at
      `dev`.

## Test plan

- **Shared unit** — `slugify`, id suffixing, pack numbering including archived gaps, reorder
  validation.
- **Worker unit** — request parsing (unknown fields rejected, required fields), validation
  simulation, parameterised 405.
- **Host tier** — `src/worker/test/admin.test.ts`: create/edit/archive/restore/order against real
  `wrangler dev` and local D1; `/v1/content` visibility before and after; content version and ETag
  change together; stale-version conflict.
- **Database tier** — extend `src/worker/test/database.test.ts`: ordering updates, soft-delete
  filters as executed.
- **Manual** — the topics/packs flows in the portal against the local Worker.

## Documentation impact

`docs/develop/worker.md` (topic and pack routes, validation and version rules),
`docs/develop/portal.md` (screens), PRD (portal scope).

## Out of scope

Word creation and pack membership (feature 30); word images (feature 31); moving a pack between
topics; bulk import/export; release and drafts.
