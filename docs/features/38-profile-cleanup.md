# Feature 38 — Profile cleanup and database bootstrap

> Priority: Must · Mission 4 · **Status: Specced**
> Depends on: 14 (Settings), 26 (top-right identity chip), 37 (badge shelf), 17 and 22 (content and
> database setup).
> Blocks: none.
> Source of truth: [Mission 4 sprint](00-mission-4-sprint.md).

## Summary

Consolidate the signed-in surfaces around one **Profile** page and make the database setup
reproducible from an empty checkout.

- Remove **Export my data** and **Diagnostics** from the page.
- Move the **Badge Shelf** into the page and rename the page from **Settings** to **Profile**.
- Remove the settings gear on Home and use the top-right **profile photo/initial** as the link.
- Add a **docs/develop/worker.md** section that explains how to initialise the database from
  scratch, locally and in production.

The `#/settings` route, the `SettingsScreen` component and the `settings.*` i18n namespace keep
their names; only what the child and parent see changes. There is no schema or Worker API change.

## User story

As a **child**, I want one obvious profile icon that takes me to my name, photo and badges. As a
**parent**, I do not need a backup or diagnostics panel in the app. As an **operator**, I can build
a fresh local or production database from the documentation without guessing which migration or
content script to run.

## Design

### Profile page and visible rename

- The page heading, eyebrow, document title and navigation label read **Profile** in both locales.
  `SettingsScreen`, the `settings` hash and the `settings.*` keys keep their names; the route stays
  `#/settings` so the topic-picker origin (`#/topics?from=settings`) and every existing link keep
  working.
- Retained sections: language, buddy name/avatar/photo, topic change, Legacy Import card, account
  and sign-out, About. The Account and About cards are not part of this cleanup.
- `HomeScreen`'s settings gear is removed; the Profile entry is the new top-right identity link
  (below).
- Update `docs/develop/page.md` and the PRD's screen copy from Settings to Profile; keep the
  historical feature docs untouched.

### Badge Shelf in Profile

- The full badge catalogue currently rendered by `BadgesScreen` — medal categories and the
  per-topic trophy grid — moves into a Profile card. `BadgeShelfCard` may become that card's
  featured/next-goal header or be removed; `useBadgeFacts`, `badgeCatalogueFor`, `badgeCopy` and
  the `badges.*` keys stay.
- Remove the Home `BadgeShelfCard` render and its `useBadgeFacts` read. The Profile page is the
  only badge surface; Home is for practice.
- Remove the standalone `#/badges` route: `BadgesScreen`, the route union/sample/simple hash/title
  key/parent entry in `src/page/router/routes.ts`, the `App.tsx` screen case, and the router test.
  Keep `NewBadgeStrip` on the session and exam summaries — earning a badge still surfaces where it
  happens.
- Keep the badge CSS used by the embedded catalogue; drop the Home-only `.badge-card` styles if the
  card is removed. The i18n key test requires the `badges` namespace to remain.

### Home and shell profile links

- Extract a small `ProfileLink` component that renders the user's uploaded photo when present,
  otherwise their name initial, with an accessible **Profile** label. It navigates to
  `#/settings` and exposes `aria-current` there.
- `HomeScreen`: replace the gear (`.icon-button`) in `.top-stats` with `ProfileLink`; remove the
  now-unused `.icon-button` CSS if nothing else uses it.
- `AppShell`: the sidebar mini-profile already links to Settings and stays. The top-right
  `.user-chip` (the only top bar on mobile) becomes the same link, so Profile remains reachable
  when the sidebar is hidden. Update its CSS for cursor/focus and remove the “display-only”
  wording in `docs/develop/page.md`.
- Reuse `avatarUrl`/`avatarInitials` from `src/page/avatar.ts`; do not duplicate the identity
  logic.

### Remove Export and Diagnostics

- Remove the export card, the diagnostics card, and their state/handlers from `SettingsScreen`:
  `exporting`/`exportFailed`, `exportBackup`, `readDeviceRows`, and the imports that exist only for
  them.
- Delete `SettingsDiagnostics.tsx`, `src/page/db/diagnostics.ts`, `src/shared/diagnostics.ts`,
  `src/page/i18n/metrics.ts`, `src/page/download.ts`, `src/shared/export.ts`, and the tests
  `src/shared/test/export.test.ts` / `src/shared/test/diagnostics.test.ts`.
- `APP_VERSION` is exported by `@shared/export` but the retained About card uses it. Relocate it
  (for example to `src/shared/app.ts`) before deleting the export module.
- Keep the `metrics` table and `METRIC_NAMES`: badges derive from those counters. Remove the
  export/diagnostics/install-status/counter strings from both locales; keep the `settings`
  namespace for the retained cards.
- Keep `POST /v1/me/import` and the Legacy Import card. The removed **Export my data** button is
  not the legacy import API.

### worker.md database bootstrap

Add one section, `## Initialise the database from scratch`, that consolidates what is currently
split across “Apply migrations to the local database” and “Before the first build” without
duplicating their commands:

**Local**

1. `cd src`; apply the committed migrations with the existing command.
2. Explain the migration set: `0000_content_schema` creates the content tables,
   `0001_seed_avatars` seeds the eight avatars and the single `content_meta` row at `0.3.0`, and
   `0002`–`0004` add user, free-session and exam tables. **No vocabulary is in the migrations.**
3. For vocabulary, apply `docs/develop/content/scripts/words.sql` and then
   `docs/develop/content/scripts/InitData.sql` with `wrangler d1 execute ... --local --file=...`.
   The order matters because `pack_words` references word ids; `InitData.sql` is re-runnable and
   bumps `content_meta` to `0.4.0`/`dev`.
4. Start the Worker and verify `/health` returns the applied version and `/v1/content` is non-empty.
5. Reset by stopping the Worker, deleting `src/worker/.wrangler/state/`, and applying migrations
   and the content scripts again. The existing local section already documents the reset; link to
   it instead of repeating it.

**Production**

1. `wrangler d1 create words-wizard`; put the returned id into
   `src/worker/wrangler.jsonc` (`d1_databases[0].database_id`).
2. Configure the Entra vars and create the R2 buckets as “Before the first build” describes.
3. Apply migrations with `--remote` (the Workers Builds deploy command does this before every
   deploy), then apply the vocabulary SQL, or use the admin portal/feature-17 content flow.
4. Run `PRAGMA foreign_key_check`, deploy, and verify `/health` plus `pnpm check:deploy`.
5. Link to `docs/operations.md` for the full production procedure and to `#debug` for the
   inspection commands.

**Warnings the section must state**

- `--local` and `--remote` are different databases; never run the remote command to test a local
  change.
- Migrations are forward-only; never edit an applied migration.
- `content_meta` must contain exactly one row; an empty table makes `/health` and `/v1/content`
  return `500`.
- The committed migrations do not include vocabulary; a fresh database serves avatars and no words
  until the content scripts or the portal populate it.
- **Do not use `docs/develop/content/backup/20261118.sql` as a bootstrap seed**: it is a
  version-specific snapshot that contains real user/profile rows, not a canonical dataset.

The existing deploy-command line asserted by
`src/page/test/scripts/deployment-config.test.ts` must remain verbatim, and the
`#local-development` / `#debug` anchors must stay stable for other docs.

## Acceptance criteria

- [ ] The page reads **Profile** in both locales; `#/settings`, `SettingsScreen` and the
      `settings.*` keys still work, including the topic-picker `from=settings` round trip.
- [ ] Export and Diagnostics are gone from the UI, their implementation modules and tests are
      deleted, and no dead imports or i18n keys remain.
- [ ] `APP_VERSION` is still available to the About card after `@shared/export` is deleted.
- [ ] The full Badge Shelf (medals and per-topic trophies) renders inside Profile; Home has no badge
      card; the `#/badges` route/screen is gone; `NewBadgeStrip` still appears on session and exam
      summaries.
- [ ] The Home gear is gone; the top-right photo/initial link opens Profile on Home and in the
      shared shell top bar, with an accessible Profile label and `aria-current`.
- [ ] The sidebar mini-profile still opens the same page.
- [ ] `docs/develop/worker.md` has the new database-initialisation section covering local and
      production from scratch, migration seeds versus vocabulary scripts, `content_meta`, reset,
      verification and the backup-file warning.
- [ ] The existing deploy-command assertion and stable anchors in worker.md still hold.
- [ ] PRD, privacy, README, page.md and the feature/sprint indexes are updated; archived feature
      docs are treated as historical.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm build:portal` and `pnpm check:dist` pass.

## Test plan

- **Unit / page** — route round-trips after removing `badges` and keeping `settings`; Profile page
  renders the badge catalogue; `ProfileLink` opens `#/settings` and shows photo/initial; i18n key
  parity in both locales.
- **Domain** — badge derivation and `NewBadgeStrip` are unchanged; `buildRecustomizePatch` and the
  retained Settings logic still pass.
- **Docs** — `deployment-config.test.ts` still passes; manual check that the new worker.md commands
  work against a fresh local D1 and that `/health`/`/v1/content` agree.
- **Manual** — fresh local database → migrations → content scripts → worker; Home top-right
  Profile link and shell chip; Profile shows the badge shelf; Export/Diagnostics and Home gear are
  absent; summary strips still show a newly earned badge.

## Documentation impact

- `docs/PRD.md` — §3 facilitator description, §4 decisions 10 and 16, §8.5 export paragraph, §11
  facilitator MVP, §13 MVP scope, §14 decision 13, §7.9 badge surfaces, Appendix A.1 screen 17 and
  Appendix A.2 navigation. Settings references become Profile.
- `docs/privacy.md` — the “Settings” references become Profile; the counters are no longer shown in
  a diagnostics view (they remain stored for badges). Keep the required privacy phrases.
- `docs/develop/page.md` — the top-right chip paragraph, Settings/Profile copy and the legacy-import
  discard references.
- `docs/develop/worker.md` — the new database-initialisation section.
- `README.md` — Settings references become Profile; Mission 4 status.
- `docs/features/00-mission-4-sprint.md` — feature row 38, status and archive note.
- Archived features 14, 24, 26 and 37 stay historical and are not rewritten; feature 38 records
  what supersedes them.

## Risks

- **APP_VERSION**: deleting `@shared/export` without relocating the constant breaks the About card.
- **Route removal**: `#/badges` has a route sample and test; removing it must update every
  exhaustive route record, and the retained `#/settings` topic origin must keep working.
- **Lost motivation surface**: removing the Home badge card removes a gentle cue; the Profile page
  and summary strips must carry that role.
- **i18n namespace test**: the `badges` and `settings` namespaces must remain non-empty.
- **Database docs drift**: the vocabulary seed lives outside the migrations and its script paths
  have been stale before; the new section must name the actual `scripts/` paths and order, and must
  not present the user-data backup as a seed.
- **Doc assertions**: worker.md's exact deploy command and the README/PRD/privacy strings tested by
  `deployment-config.test.ts` must survive.

## Out of scope

Renaming the `#/settings` route, `SettingsScreen` or the `settings.*` namespace; deleting the
`metrics` table or counter rows; changing badge rules or thresholds; removing the account,
sign-out, About or legacy-import cards; changing `POST /v1/me/import`; migrating or resetting
production data; re-adding a Home settings gear; new Worker routes or schema changes.
