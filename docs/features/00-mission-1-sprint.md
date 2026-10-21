# Mission 1 — Sprint Goal: "A child, a buddy, and a session that survives a reload"

> Status: **In progress — features 01–11 done and archived; feature 12 in review; features 13–17 not started.**
> Source of truth: [docs/PRD.md](../PRD.md) v0.2. Where this file and the PRD disagree, the PRD wins.

## Goal

Ship the offline-first MVP: a Chinese-speaking child aged 9–12 creates a word buddy, picks a
topic, completes a 6–8 minute bilingual session, and finds their progress, XP, streak, and
Care Tokens intact after closing the app. No backend, no accounts, no network at runtime.

The work is ordered so each feature is a **vertical slice** that can be demonstrated on a
device, not a layer that only becomes useful three features later. Content (17) can run in
parallel from feature 04 because it is authoring work, not code.

## Definition of Done (whole mission)

- [ ] The app, toolchain, and build output live under `src/`; `cd src && pnpm build` produces
      `src/dist/` and the build carries no Figma Make plugins.
- [ ] A first run goes: character creation → install prompt → topic picker → Home.
- [ ] A full session runs end to end: 5 reviews + 4 new words, intro cards, all five modes,
      escalating hints, summary.
- [ ] Progress commits once, at session end, in a single Dexie transaction; a reload shows the new state.
- [ ] XP, stage, streak, vitality, sleep state, and Care Tokens follow PRD §7 and §9 exactly.
- [ ] My Words (Collection + Word Book + Word Detail) and Monthly Review are usable.
- [ ] Settings covers locale, re-customization, topic change, JSON export, and diagnostics.
- [ ] The app installs, works fully offline after first load, and shows an update prompt instead of
      silently swapping the service worker.
- [ ] `pnpm build` + CI deploy the app to Cloudflare Pages; the deployed site passes the smoke check.
- [ ] Final content: 300 slots across 5 topics × 3 packs × 20, bilingual, Cambridge-allowlisted,
      with one reviewed illustration per distinct word plus 15 avatar-stage images (≈315);
      `pnpm validate:content` passes.
- [ ] Vitest domain tests pass; the manual E2E checklist is signed on iPad Safari and Edge.
- [ ] No telemetry, analytics, or third-party runtime requests.

## Feature table

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 01 | [App foundation & test harness](archive/01-app-foundation.md) | Done | — |
| 02 | [App shell & hash routing](archive/02-app-shell-routing.md) | Done | 01 |
| 03 | [Bilingual UI (i18n)](archive/03-i18n.md) | Done | 01, 02 |
| 04 | [Content layer & validation](archive/04-content-layer.md) | Done | 01 |
| 05 | [Persistence layer (Dexie)](archive/05-persistence.md) | Done | 01 |
| 06 | [First run: character creation & topic picker](archive/06-first-run.md) | Done | 02, 03, 04, 05 |
| 07 | [Session engine](archive/07-session-engine.md) | Done | 04, 05, 06 |
| 08 | [Five practice modes](archive/08-practice-modes.md) | Done | 03, 04, 07 |
| 09 | [Progression: commit, XP, streak, tokens, summary](archive/09-progression.md) | Done | 05, 07, 08 |
| 10 | [Character state & character screen](archive/10-character-state.md) | Done | 04, 05, 09 |
| 11 | [Home hub](archive/11-home.md) | Done | 06, 07, 09, 10 |
| 12 | [My Words: Collection & Word Book](12-my-words.md) | In progress | 04, 05, 08, 09 |
| 13 | [Monthly Review](13-monthly-review.md) | Not started | 07, 08, 09, 11 |
| 14 | [Settings, export & diagnostics](14-settings.md) | Not started | 03, 05, 06, 09, 10 |
| 15 | [PWA install, offline & updates](15-pwa-offline.md) | Not started | 02, 05, 14 |
| 16 | [Cloudflare Pages deployment & CI](16-cloudflare-pages.md) | Not started | 01, 04, 15 |
| 17 | [Content production: 300 words & 315 illustrations](17-content-production.md) | Not started | 04 (authoring runs in parallel) |

Completed feature files move to [`archive/`](archive/); the table keeps the row for history.

## Vertical slice map

```
01 Foundation
 └─► 02 Shell & routing
      └─► 03 i18n
04 Content layer ──────────────┐
05 Persistence ────────────────┤
      └──────────────► 06 First run (creation + topic picker)
                              └─► 07 Session engine
                                   └─► 08 Five modes
                                        └─► 09 Progression & summary
                                             ├─► 10 Character state
                                             │    └─► 11 Home
                                             ├─► 12 My Words
                                             └─► 13 Monthly Review
                                                  14 Settings
                                                   └─► 15 PWA / offline
                                                        └─► 16 Cloudflare CI/CD
17 Content production ── parallel from 04 ── must land before release
```

## Mission tasks (implementation order)

1. **01** — Scaffold the production app under `src/`; leave the Figma Make export untouched; add
   Vitest, `strict` TS, `src/config.ts`, and domain types.
2. **02** — Hash router, route table, guards, AppShell, placeholder screens.
3. **03** — `locales/en.json` + `zh.json`, `t()`, locale detection, `html lang`, key-parity test.
4. **04** — Bilingual `content/` schemas, read-only data-access layer, `validate:content`, artwork manifest.
5. **05** — Dexie schema, Profile/Progress/Metrics/Device repositories, `ProgressProvider`, `persist()`,
   startup and post-session checks.
6. **06** — Character creation (name + 3 avatars), profile defaults, topic picker.
7. **07** — Session builder, mode rotation, intro/exercise state machine, hint escalation, exit confirm.
8. **08** — Picture match, word → meaning, spelling builder, fill the blank, listen & choose.
9. **09** — Scheduler deltas, XP/stage, streak, Care Token ledger, one-transaction commit, summary.
10. **10** — Derived vitality/sleep, character screen, freeze and quick wake, stage art mapping.
11. **11** — Home hub: character, streak, today's session, cards, caught-up and sleepy states.
12. **12** — Collection tab, Word Book tab, Word Detail, empty states.
13. **13** — 28-day trigger, 20-word selector, review runner, review summary.
14. **14** — Locale toggle, re-customize, change topic, JSON export, diagnostics.
15. **15** — Manifest/icons, Workbox precache, update prompt, install detection and strong prompt.
16. **16** — GitHub Actions build/test/validate/deploy to Cloudflare Pages, cache headers, dist smoke check.
17. **17** — Author and review 300 bilingual slots and 315 illustrations; flip the dataset to `final`.

## Sequencing caveats

- **Do not publish a public release before 17 lands.** Features 01–16 run against a `dataset: "dev"`
  content set (one authored pack plus placeholders). The app is demonstrable, but it is not the product.
- **Feature 01 establishes the build under `src/`.** Until it lands, nothing builds and every later
  feature is blocked.
- **Feature 15 must not ship a service worker over the dev dataset** to a public URL: a stale precache
  with placeholder art is worse than no cache. Deploy (16) comes after 15 and after content sign-off.
- Branching and PRs follow the project workflow: feature branches target `develop`; `master` is the
  release branch that 16 deploys from.

## Out of scope (see [backlog.md](backlog.md))

Badges, multi-profile UI, Tricky Words, story mode, timed challenges, speaking practice, custom
words/import, cloud sync, and any parent dashboard. Phase 2/3 in PRD §13.
