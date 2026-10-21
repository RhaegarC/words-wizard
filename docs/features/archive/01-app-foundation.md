# Feature 01 — App Foundation & Test Harness

> Priority: Must · Mission 1 · **Status: In review**
> Depends on: — (foundation for every other feature)

## Summary

Scaffold the production app with **everything under `src/`** — package manifest, lockfile,
TypeScript and Vite configs, `index.html`, `public/`, scripts, and React code. The repository root
holds only repository-level files: `README.md`, `LICENSE`, `.gitignore`, `docs/`, and `figma/`. The
Figma Make export in `figma/` is a **read-only visual reference and must not be modified** — no file
moved out of it, no generated file written into it. The production toolchain is independent of the
prototype's toolchain.

This feature creates the build, the test harness, and the two files every later feature imports:
`src/config.ts` (all tunables from PRD §12) and `src/domain/types.ts` (the canonical records from
PRD §6, §7, §8).

## User story

As a **developer**, I can run `pnpm dev`, `pnpm build`, and `pnpm test` from `src/`, and every
tunable and record type has one home, so feature work never re-invents either. As a **designer**,
the Figma Make export stays exactly as exported, so it can be re-synced or compared at any time.

## Acceptance criteria

- [x] **Everything the app needs lives under `src/`**: `package.json`, `pnpm-lock.yaml`,
      `tsconfig.json`, `vite.config.ts`, `index.html`, `public/`, `scripts/`, and React code. The
      repository root contains no app or toolchain files.
- [x] **`figma/` is untouched**: `git status --short figma` is empty after the feature lands, and no
      production file imports from `figma/`.
- [x] `src/vite.config.ts` contains only React, Tailwind 4, and the `@` alias, with the Vite root set
      to its own directory, `publicDir: "public"`, and `build.outDir: "dist"` — no `.figma/`
      imports, no Figma site-configuration, error-overlay, refresh-boundary, or Make-kit plugins.
- [x] From `src/`, `pnpm dev` serves on port 8443; `pnpm build` emits `src/dist/`; `pnpm preview`
      serves it.
- [x] From `src/`, `pnpm test` runs Vitest; `pnpm test:watch` watches; `pnpm typecheck` runs
      `tsc --noEmit`.
- [x] TypeScript is `strict`; no `any` in new code without a written reason.
- [x] `src/config.ts` exports exactly the tunables in PRD §12, grouped as written there.
- [x] `src/domain/types.ts` exports `Word`, `Topic`, `Pack`, `Profile`, `Progress`, `Metric`, `Device`,
      `CharacterState`, `StageId`, `PracticeMode`, and `SessionResult`, plus runtime `STAGE_IDS` and
      `PRACTICE_MODES` constants so exhaustiveness can be tested.
- [x] `src/main.tsx`, `src/App.tsx`, and `src/index.css` render a minimal production boot screen that
      uses the prototype's color tokens; screens themselves are built in features 02–17.
- [x] `src/public/manifest.webmanifest` names the product, uses `start_url: "./"`,
      `display: standalone`, and declares 192 px and 512 px icons (PNG) plus a maskable icon.
- [x] `src/index.html` has the correct title, description, theme color, and `<html lang>`
      placeholder that feature 03 will drive at runtime.
- [x] A root `.gitignore` excludes `node_modules/`, `dist/`, `coverage/`, and local env files.
- [x] `README.md` run instructions match the `src/` layout and note that `figma/` is read-only.
- [x] From a clean install in `src/`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Tasks (ordered)

1. Add the root `.gitignore` (`node_modules/`, `dist/`, `coverage/`, `.env*`, editor/OS files).
2. Add `src/package.json`: React 19, React DOM 19, Dexie 4, Tailwind 4, Vite 8, TypeScript 5.7,
   Vitest, oxfmt; scripts `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `format`.
3. Add `src/tsconfig.json`: `strict`, `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit`,
   `types: ["node"]`, `paths` for `@/*` → `./*`; include `**/*.ts` and `**/*.tsx`.
4. Add `src/vite.config.ts`: Vite root is its own directory, `publicDir: "public"`,
   `build.outDir: "dist"`, React + Tailwind plugins, `@` alias, `server.port = 8443`,
   `strictPort`, `base: "./"`, and the Vitest block (`environment: "node"`,
   `include: ["**/*.test.ts"]`).
5. Add `src/index.html` with the product title, description, theme color, manifest link, and root
   mount.
6. Add `src/main.tsx`, `src/App.tsx`, and `src/index.css`: Tailwind import, the prototype's color
   tokens and base resets, and a minimal boot screen naming the production app.
7. Run `pnpm install` from `src/` and commit the lockfile.
8. Add `src/config.ts` exactly as PRD §12 (XP, stages, dormancy, streak, Care Tokens, session,
   scheduler, monthly review, unlock, speech).
9. Add `src/domain/types.ts`, with `StageId` derived from the config's stage list and runtime
   `STAGE_IDS` / `PRACTICE_MODES` constants.
10. Add `src/public/manifest.webmanifest` and 192/512/maskable placeholder icons under
    `src/public/icons/`.
11. Update `README.md`: commands run from `src/`, port, layout, and "`figma/` is read-only
    reference".
12. Verify from `src/`: `git status --short figma` empty; `pnpm typecheck`, `pnpm test`,
    `pnpm build`; `pnpm dev` serves the boot screen on 8443.

## Tests

**Unit (Vitest, always offline):**

- `config.test.ts` — stage thresholds are strictly ascending and start at 0; XP values match PRD §7.2;
  session caps match PRD §5; scheduler deltas and intervals match PRD §9; unlock values are
  `0/15/30`; monthly-review values match PRD §7.4.
- `types.test.ts` — `STAGE_IDS` matches the configured stage ids exactly and in order;
  `PRACTICE_MODES` has five unique values; `stageForXp`-style lookup is not added until feature 09,
  so the test asserts only the shared vocabulary.

**Verification (manual):**

- From `src/`, `pnpm dev` on port 8443 shows the production boot screen.
- From `src/`, `pnpm build && pnpm preview` serves the same build from `src/dist/`.
- `git status --short figma` is empty before and after the build.
- A clean clone + `cd src` + `pnpm install` + `pnpm test` is green.

## Non-goals

- No screen porting, routing, storage, i18n, or behaviour in this feature; features 02–17 build the
  UI in `/src` with `figma/` as the visual reference.
- No service-worker or deployment work (features 15 and 16).
- No final brand icons or illustrations (feature 17).
