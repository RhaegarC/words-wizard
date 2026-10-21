# Words Wizard

A bilingual (English + 中文) offline-first PWA that helps Chinese-speaking children
aged 9–12 learn English vocabulary through short, game-like sessions with a virtual
word buddy.

**Status:** MVP requirements locked in [docs/PRD.md](docs/PRD.md) (v0.2). The UI in
[figma/](figma/) is a working prototype; the production app will be promoted from it.

---

## What v1 is

- **5 topics × 3 packs × 20 words** (300 word slots) drawn from the Cambridge
  Starters/Movers/Flyers 2025 allowlist.
- **Fully bilingual:** English + 中文 UI and content, with a Settings toggle.
- **Five practice modes:** picture match, word → meaning, spelling builder,
  fill-the-blank, and listen & choose.
- **A virtual buddy:** create it, earn XP, grow through five stages, and keep it awake.
  It falls asleep after 7 days without practice and is always revivable.
- **My Words:** a countable Collection tab and an illustrated, mastered-only Word Book
  tab.
- **Monthly Review:** a 20-word retention check every 28 days.
- **Offline PWA:** IndexedDB via Dexie, no backend, no accounts, no sync, no telemetry.
- **Speech via the Web Speech API**, with IPA fallback when no suitable voice exists.
- **Azure Blob Storage static hosting** with hash routing.
- **315 illustrations:** ~300 word images plus 3 avatars × 5 stages, AI-generated and
  human-reviewed.

## Repository layout

| Path | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | v0.2 product requirements — the document of record |
| [docs/features/](docs/features/) | Mission 1 sprint index, 17 ordered feature specs, and the backlog |
| [docs/sample_data/](docs/sample_data/) | Inputs kept for reference, not the v1 content set: `Init/` (historical discovery notes, superseded by the PRD), the Cambridge 2025 word-list PDF, the early 36-word `words.json`, and `content/` (scaffold topics, packs, and words) |
| [figma/](figma/) | React 19 + Vite 8 + Tailwind 4 + Dexie 4 UI prototype |

## Current content state

The content set is incomplete and is the critical path for the MVP. Everything in
[docs/sample_data/content/](docs/sample_data/content/) is scaffolding, not the v1
content set:

- 5 topics and 20 packs exist (4 packs per topic, 25 slots per pack = 500 slots), but
  only **57 words** are authored; **360 distinct referenced word IDs are missing**.
- Three of the five topics have no words yet.
- The sample words use the older English-only shape (`audioUrl`, `imageUrl`, a single
  `definition`, and string examples) with no IPA or Chinese fields. They will be
  migrated to the v0.2 bilingual schema; pronunciation will be synthesized, so no
  audio files are needed.
- The sample's 4-packs-of-25 shape is **not** the target. Target: **15 packs
  (3 per topic) × 20 words = 300 slots**, bilingual glosses, definitions, and examples,
  plus 300 word illustrations.
- No illustration assets exist yet.

Content is authored AI-assisted and then reviewed in full by a Chinese-speaking English
teacher. Automated validation will enforce schema completeness, ID integrity, both
languages, image existence, and the Cambridge allowlist.

## Run the prototype

The prototype is the Figma Make app in `figma/`. From that directory:

```bash
cd figma
pnpm install
pnpm dev
```

The dev server uses port `8443` by default. Inside Figma Make, the preview server is
already provided; `pnpm dev` is only needed for local development.

Note: `figma/vite.config.ts` currently contains Figma Make-specific plugins. They will
be stripped when the app is promoted to the production build.

## Testing

Planned for the production app:

- **Vitest** for pure domain logic: XP and stage derivation, vitality and sleep, streak
  grace, Care Token ledger, SM-2 scheduling, session builder, Monthly Review selection,
  Collection selectors, i18n key completeness, and content integrity.
- **Manual end-to-end checks** on iPad Safari and Edge for install, offline behavior,
  IndexedDB persistence, and Web Speech.

There is no component-test suite; the UI is a design-exported frontend and is verified
manually.

## Deployment

Planned: Azure Blob Storage static website (`$web` container), deployed by GitHub
Actions. The build must set correct MIME types and cache headers, and the service worker
precaches the shell, content, locales, and all illustrations.

## Key decisions

The full decision log is in §14 of [docs/PRD.md](docs/PRD.md).
The most important changes from the original concept:

- Bilingual UI and content, not English-only.
- Web Speech API instead of bundled audio.
- A strong, repeated install prompt instead of a hard installation gate.
- Five topics and all five practice modes in the MVP.
- Character stage and vitality are derived, never stored.
- Monthly Review is on a rolling 28-day cycle.
- Single-profile UI; `profileId` stays in the schema for a future switcher.
- Local metrics only; no telemetry.

## License

See [LICENSE](LICENSE).
