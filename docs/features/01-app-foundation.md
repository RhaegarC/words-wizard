# Feature 01 — App Foundation & Test Harness

> Priority: Must · Mission 1 · **Status: Not started**
> Depends on: — (foundation for every other feature)

## Summary

Promote the Figma Make prototype in `figma/` into the production app at the repository root.
Strip the Figma Make Vite plugins and dependencies, tighten TypeScript, add the Vitest harness,
and create the two files every later feature imports: `src/config.ts` (all tunables from PRD §12)
and `src/domain/types.ts` (the canonical records from PRD §6, §7, §8).

The prototype stays in git history at commit `f805071` ("New design"); the working directory is
replaced by the promoted app.

## User story

As a **developer**, I can run `pnpm dev`, `pnpm build`, and `pnpm test` from the repository root,
and every tunable and record type has one home, so feature work never re-invents either.

## Acceptance criteria

- [ ] `package.json`, `index.html`, `src/`, `public/`, `vite.config.ts`, `tsconfig.json`, and the
      lockfile live at the repository root; `figma/` is gone from the working tree.
- [ ] `vite.config.ts` contains only React, Tailwind 4, and the `@` alias — no `.figma/` imports,
      no Figma site-configuration, error-overlay, refresh-boundary, or Make-kit plugins.
- [ ] `pnpm dev` serves on port 8443; `pnpm build` emits `dist/`; `pnpm preview` serves it.
- [ ] `pnpm test` runs Vitest; `pnpm test:watch` watches; `pnpm typecheck` runs `tsc --noEmit`.
- [ ] TypeScript is `strict`; no `any` in new code without a written reason.
- [ ] `src/config.ts` exports exactly the tunables in PRD §12, grouped as written there.
- [ ] `src/domain/types.ts` exports `Word`, `Topic`, `Pack`, `Profile`, `Progress`, `Metric`, `Device`,
      `CharacterState`, `StageId`, `PracticeMode`, and `SessionResult` (the last three defined now so
      later features share one vocabulary).
- [ ] `public/manifest.webmanifest` names the product, uses `start_url: "./"`, `display: standalone`,
      and declares 192 px and 512 px icons (PNG) plus a maskable icon.
- [ ] `index.html` has the correct title, description, theme color, and `<html lang>` placeholder
      that feature 03 will drive at runtime.
- [ ] `README.md` run instructions match the root layout.
- [ ] The existing prototype screens are preserved visually; only their location and imports change.

## Tasks (ordered)

1. `git mv figma/package.json figma/index.html figma/tsconfig*.json figma/vite.config.ts figma/src figma/public .`
   and move the lockfile; confirm `git status` shows renames, not deletions.
2. Delete `figma/.figma/`, `figma/AGENTS.md`, `figma/CLAUDE.md`, and any empty remainder; record the
   prototype commit hash in the PR description.
3. Rewrite `vite.config.ts`: React + Tailwind + `@` alias, `server.port = 8443`, `strictPort`, `base: "./"`.
4. Remove Figma Make dev-only dependencies from `package.json`; keep React 19, Dexie 4, Tailwind 4,
   Vite 8, TypeScript 5.7; add `vitest` and `@vitest/coverage-v8` (or leave coverage out until needed).
5. Add scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `format`.
6. Configure Vitest: `environment: "node"`, `include: ["src/**/*.test.ts"]`, alias `@` → `src`.
7. Add `src/config.ts` exactly as PRD §12 (XP, stages, dormancy, streak, Care Tokens, session,
   scheduler, monthly review, unlock, speech).
8. Add `src/domain/types.ts` and import the config's stage list into `StageId` so the two cannot drift.
9. Update `public/manifest.webmanifest` and add the 192/512/maskable icons to `public/icons/`
   (placeholder brand mark is acceptable until feature 17 supplies final art).
10. Update `README.md`: root commands, port, and where `config.ts` and domain types live.
11. Run `pnpm typecheck`, `pnpm test`, and `pnpm build`; start `pnpm dev` and confirm the prototype
    screens still render.

## Tests

**Unit (Vitest, always offline):**

- `config.test.ts` — stage thresholds are strictly ascending and start at 0; XP values match
  PRD §7.2; session caps match PRD §5; scheduler deltas and intervals match PRD §9; unlock values
  are `0/15/30`.
- `types.test.ts` — a compile-time exhaustiveness check that `StageId` covers every config stage id
  and every `PracticeMode` has a label key (the label key test lands with feature 03).

**Verification (manual):**

- `pnpm dev` on port 8443 shows the prototype's Screens (Creation, Home, Practice, Words, Buddy).
- `pnpm build && pnpm preview` serves the same.
- `pnpm test` is green before any feature code exists. A suite that starts red makes the next RED
  unreadable.

## Non-goals

- No routing, storage, i18n, or behaviour changes to the prototype screens.
- No service-worker or deployment work (features 15 and 16).
- No final brand icons or illustrations (feature 17).
