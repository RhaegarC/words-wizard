# Mission 3 — Sprint Goal: "Teachers own the words"

> Status: **Planned — scope only. Details are intentionally unfilled.**
> Depends on: Mission 2 (features 21–25) complete and deployed.
> Source of truth: [docs/PRD.md](../PRD.md) as amended by Mission 2 and this mission. Where this
> file and a later Mission 3 feature doc disagree, the feature doc wins once its design is locked.

## Goal

Give teachers and administrators a portal where they manage the vocabulary and its artwork
directly, without writing migration SQL. Mission 2 stores content in D1 and serves it from
`GET /v1/content`; this mission adds the write side — the roles, the editing surface, the artwork
pipeline, and the review workflow that turns authored rows into a released dataset.

The child-facing app does not change in this mission beyond whatever the content model requires.

## What already exists to build on

- **Entra ID sign-in and the Worker edge** (features 21 and 23): every caller already has a
  verified `oid`, and the error envelope, CORS, and D1 binding are in place. The portal reuses the
  identity provider; only authorization is new — feature 23 deliberately ships no roles.
- **The four content tables** (feature 22): `topics`, `packs`, `words`, and `pack_words`, plus
  `content_meta`. The portal writes these rows; it does not change their shape.
- **The shared validator**: structural rules always, editorial rules at `dataset: 'final'`. The
  portal runs the same rules on write, so hand-written SQL and portal writes cannot diverge.
- **Reviewed migration authoring** (feature 17): how content is authored today. The portal replaces
  the SQL step; it does not replace the teacher review or the release gate.

## Content rules the portal must honour

These are locked in Mission 2 and are not open for reconsideration here.

- Ids are immutable and never reused. A content id is its identity; display text is editable.
- Removal is soft: `archived_at` on `topics`, `packs`, and `words`. There is no hard delete of a
  content row.
- Archived rows, and rows whose ancestor is archived, are omitted from `GET /v1/content`; the row
  itself survives, so an in-flight session commit that names it stays valid.
- Content foreign keys never cascade. `pack_introductions` rows outlive an archived word.
- One row per headword, with case-insensitive unique `text`; extra senses go in the existing row's
  free-text part of speech and meanings, not in a second row.
- `pack_words.position` is contiguous from 1 within a pack. The database cannot express that
  cheaply, so the write path enforces it and the validator checks it.
- Every content change bumps `content_meta.content_version`, because the public API's `ETag` and
  `/health` read it.
- Authoring status (draft, in review, approved) lives **only** in the admin layer; the public
  vocabulary schema does not carry it.

## Candidate scope

Provisional. The feature split and numbering are decided when the design is locked.

| Area | What it covers |
|---|---|
| Roles and access | Teacher and administrator roles mapped from Entra; every admin route refuses an unauthenticated or unauthorised caller before any read or write. |
| Vocabulary admin | Browse, create, edit, and archive words; manage topics and packs, their order, and pack membership. |
| Artwork pipeline | Upload a reviewed image to R2, record its URL in `words.image`, and track approval. |
| Review and release | Authoring status per record, teacher sign-off, and the transition to `dataset: 'final'` behind a validator gate. |
| Audit | Who changed what, for a content set several people edit. |

## Open decisions

To be resolved in a design session before any feature is specced.

- **Role model.** Entra app roles, security groups, or a small `admins` table? What does a teacher
  do that an administrator does not?
- **Where the portal lives.** A separate Pages app on its own host, a route in the existing SPA, or
  a Worker-served admin UI. The choice drives CORS, CSP, and how the admin bundle is kept out of
  the child-facing build.
- **Write path.** Admin API endpoints writing D1 directly, or a portal that generates the reviewed
  migration a human still applies. Mission 2 committed migrations by hand; the portal removes that
  step only if both paths share one validator.
- **Draft versus live.** Does a save go live immediately with a content-version bump, or wait for
  approval? If it waits, where do drafts live?
- **Artwork storage.** R2 bucket layout, path convention, upload limits, and the cache headers the
  child app sees.
- **Audit trail.** Whether an audit table ships in this mission or the next, and how long it is
  kept.
- **Archive and restore.** Whether the portal can restore an archived row, and what that means for
  a content version.

## Definition of Done (draft)

- [ ] A teacher signs in with the same Entra identity as the child app and sees only the portal.
- [ ] A non-admin caller is refused on every admin route, before any read or write.
- [ ] A word, topic, or pack created or edited in the portal runs the shared validator; content
      that fails cannot be released.
- [ ] Archiving hides a row from `GET /v1/content` without breaking an existing introduction or
      progress row.
- [ ] An approved image reaches R2 and appears in the child app through `Word.image`.
- [ ] A release bumps `contentVersion`; the child app picks it up through the existing `ETag`.
- [ ] No content change requires a migration file written by hand.

## Feature table

No Mission 3 feature is specced yet. Mission 2 ends at feature 25, so Mission 3 claims **26
onwards**; a number stays reserved until a file exists.

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 26 | Admin portal foundation | Not specced | 25 |
| 27 | Vocabulary admin | Not specced | 26 |
| 28 | Artwork pipeline | Not specced | 26 |
| 29 | Review and release workflow | Not specced | 27, 28 |

## Out of scope

Parent or teacher dashboards over a child's progress; editing another user's profile, progress, or
introductions; class rosters; analytics beyond the existing per-user counters; recorded audio; and
any change to the child-facing session model.
