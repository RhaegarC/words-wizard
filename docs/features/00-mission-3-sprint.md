# Mission 3 — Sprint Goal: "Teachers own the words"

> Status: **In progress — features 28–31 archived; 32–33 deferred.**
> Depends on: Mission 2 (features 21–27) repository work complete; production provisioning and the
> content release gate are operator-owned.
> Source of truth: [docs/PRD.md](../PRD.md) as amended by Mission 2 and this mission. The UI shape
> is written for design in [docs/Portal.md](../Portal.md). Where this file and a later Mission 3
> feature doc disagree, the feature doc wins once its design is locked.

## Goal

Give teachers and administrators a portal where they manage the vocabulary directly, without
writing migration SQL. Mission 2 stores content in D1 and serves it from `GET /v1/content`; this
mission adds the write side.

The v1 portal is a **second Cloudflare Pages app** at `admin.words.nioh.uk`, with its source under
`src/portal`. The existing Worker serves the admin APIs, so deployment stays **two Pages projects
and one Worker**. It covers topics, packs, words, pack membership, and word images. Release,
drafts, artwork approval, and audit are later sub-tasks.

The child-facing app does not change in this mission beyond caching word images.

## What already exists to build on

- **Entra ID sign-in and the Worker edge** (features 21 and 23): every caller has a verified `oid`,
  and the error envelope, CORS, and D1 binding are in place. The portal reuses the identity
  provider and the existing app registration.
- **Roles and identity data** (feature 26): the core registration defines `user`, `teacher`, and
  `admin` app roles; the verified token carries them and `profiles.role` stores the result. The
  portal consumes the token's role; what is new is **authorization** — refusing a caller before
  any read or write.
- **The four content tables** (feature 22): `topics`, `packs`, `words`, and `pack_words`, plus
  `content_meta`, with `archived_at` and ordering already present. No schema change is needed.
- **The shared validator**: structural rules always, editorial rules at `dataset: 'final'`. The
  portal runs the same rules on write, so hand-written SQL and portal writes cannot diverge.
- **The avatar pipeline** (feature 26): magic-byte detection, an R2 bucket behind a Worker
  binding, and an immutable cached read path. Word images reuse the pattern with a separate
  bucket.
- **Reviewed migration authoring** (feature 17): how content is authored today. The portal replaces
  the SQL step.

## Content rules the portal must honour

These are locked in Mission 2 and are not open for reconsideration here.

- Ids are immutable and never reused. A content id is its identity; display text is editable.
- Removal is soft: `archived_at` on `topics`, `packs`, and `words`. There is no hard delete of a
  content row.
- **The portal archives and restores topics and packs only. Words are never deleted or archived** —
  they are created, edited, and added to or removed from packs. The `words.archived_at` column
  stays for historical rows; no portal screen sets it.
- Archived rows, and rows whose ancestor is archived, are omitted from `GET /v1/content`; the row
  itself survives, so an in-flight session commit that names it stays valid.
- Content foreign keys never cascade. `pack_introductions` rows outlive an archived word.
- One row per headword, with case-insensitive unique `text`; extra senses go in the existing row's
  free-text part of speech and meanings, not in a second row.
- `pack_words.position` is contiguous from 1 within a pack. The database cannot express that
  cheaply, so the write path enforces it and the validator checks it.
- Every content change bumps `content_meta.content_version`, because the public API's `ETag` and
  `/health` read it.
- A word may belong to many packs; editing it in the word library changes every pack it appears in.

## Portal v1 scope (locked)

- **Two apps, one API.** A second Pages app at `admin.words.nioh.uk`; the existing Worker serves
  the admin operations.
- **Staff only.** Teacher and admin are identical in v1. Anonymous callers are rejected; a
  signed-in `user` sees Access Denied and is refused before any read or write. Admin-only
  capabilities arrive in a later sprint.
- **Live saves.** There is no Release button and no draft state. A save writes the change and bumps
  the content version immediately. A new device or a cache-miss client can therefore see an edit
  as soon as it is saved — this is a deliberate trade-off.
- **Topics and packs:** create, edit, order, archive, restore.
- **Words:** create and edit only — never delete or archive. A global word library; a word may be
  added to or removed from any pack.
- **Pack contents:** ordered membership, contiguous from 1.
- **Word images:** upload, replace, and remove a PNG/JPEG/WebP (up to 2 MB) to a dedicated R2
  bucket; the emoji is edited as text. Artwork review and approval stay deferred.
- **Generated ids:** derived from the title or headword, shown read-only, never reused.
- **Validation:** structural errors block a save; editorial warnings are shown but do not block
  while the dataset is `dev`.

## Decisions (locked)

The design session resolved every decision that was open in the previous revision of this file:

| Decision | Answer |
|---|---|
| Where the portal lives | A separate Pages app at `admin.words.nioh.uk`, source in `src/portal`. |
| Role model | Teacher and admin identical in v1; `user` is refused. |
| Write path | The portal calls admin endpoints on the existing Worker; no generated migrations. |
| Draft versus live | Live saves; every mutation bumps the content version. No drafts. |
| Release | Not part of v1; there is no Release button. |
| Artwork storage | A dedicated R2 bucket for word images, not the avatar bucket; upload + public read in v1; approval later. |
| Archive and restore | Topics and packs archive and restore; words are never archived or deleted. |
| Audit trail | Deferred. |
| Id generation | Server-derived slug, read-only, collision-suffixed, never reused. |

## Definition of Done (v1)

- [ ] A teacher or admin signs in with the same Entra identity as the child app and sees the
      portal; a signed-in `user` sees Access Denied and is refused on every admin operation.
- [ ] Anonymous callers are refused before any read or write.
- [ ] Topics and packs can be created, edited, reordered, archived, and restored; archived items
      appear in the Archived view and disappear from the child app.
- [ ] Words can be created and edited and added to or removed from packs; no screen deletes or
      archives a word.
- [ ] Pack membership is ordered, contiguous from 1, and the child app sees the same order.
- [ ] A word image can be uploaded, replaced, and removed, and it appears in the child app.
- [ ] Structural validation failures block a save; editorial warnings do not; both are visible.
- [ ] Every accepted change bumps the content version and the child app refetches it.
- [ ] Generated ids are read-only, collision-free, and never reused.
- [ ] No content change requires a migration file written by hand.

## Sub-tasks

Mission 2 ends at feature 27, so Mission 3 claims **28 onwards**. Features 28–31 have their own
design files; this table is the index, and completed files move to `archive/mission-3/` when they
ship.

| # | Sub-task | Status | Depends on |
|---|----------|--------|------------|
| 28 | [Admin portal foundation](archive/mission-3/28-admin-portal-foundation.md) — second Pages app, Entra sign-in reusing the existing registration, teacher/admin gate, portal shell and navigation, read-only content snapshot, local dev and CI build | Done | 25, 26 |
| 29 | [Topics and packs](archive/mission-3/29-topics-and-packs.md) — create, edit, order, archive and restore; shared write mechanics; the Archived view | Done | 28 |
| 30 | [Word library and pack membership](archive/mission-3/30-word-library-and-membership.md) — word create and edit (no delete or archive), searchable library, ordered pack contents | Done | 28, 29 |
| 31 | [Word images](archive/mission-3/31-word-images.md) — upload, replace, and remove to a dedicated bucket; public image serving; child-app cache rule | Done | 30 |
| 32 | Artwork review and approval — review states, sign-off, and tracked approval | Not specced — deferred | 31 |
| 33 | Release workflow — dataset `final` transition behind the validator, with a publish action | Not specced — deferred | 29–32 |

Sub-tasks 32 and 33 deliberately stay unspecced: v1 ships live-save CRUD, and neither has a place
in the current product decision.

## Out of scope

Parent or teacher dashboards over a child's progress; editing another user's profile, progress, or
introductions; class rosters; analytics beyond the existing per-user counters; recorded audio; any
change to the child-facing session model; deleting or archiving words; moving a pack between
topics; bulk import or export; portal offline use; and teacher/admin role administration.
