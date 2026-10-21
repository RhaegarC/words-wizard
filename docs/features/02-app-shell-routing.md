# Feature 02 — App Shell & Hash Routing

> Priority: Must · Mission 1 · **Status: Not started**
> Depends on: 01

## Summary

Replace the prototype's screen-switching state with a real hash router and a single app shell.
Every route is a fragment (`#/home`), so the build behaves identically on `pnpm preview`, any
static host, and Azure Static Web Apps without depending on rewrite configuration; the host's
navigation fallback is a safety net, not the routing mechanism. The shell owns the header, back
behaviour, focus reset, and the first-run guard; each screen becomes a route target.

## User story

As a **child**, I can move between Home, practice, my words, my buddy, and settings without the
page reloading, and the back button does what I expect. As a **facilitator**, I can reopen the app
on the same screen after a reload.

## Acceptance criteria

- [ ] Supported routes exactly match PRD Appendix A.2:
      `#/home`, `#/topics`, `#/session`, `#/session/intro`, `#/session/exercise`,
      `#/session/summary`, `#/words?tab=collection|wordbook`, `#/words/:wordId`, `#/character`,
      `#/review`, `#/review/summary`, `#/settings`, `#/create`, `#/install`.
- [ ] Unknown or malformed hashes resolve deterministically: profile present → `#/home`;
      no profile → `#/create`. No blank screen, no exception.
- [ ] Boot guard: no profile with a character → `#/create`; profile present → the requested route is
      honoured, including a deep link after a reload.
- [ ] Browser back/forward work; a route change scrolls to top and moves focus to the screen's
      heading.
- [ ] The shell renders a header with an optional back affordance, a title, and a content slot;
      touch targets are at least 44×44 px.
- [ ] Every MVP screen in Appendix A.1 has a route target. Until its feature lands, the target is an
      explicit placeholder that names the feature — no dead links.
- [ ] The in-session back path is owned by the session engine (feature 07); the shell exposes a
      `beforeLeave` hook it can veto, and the default is "leave".
- [ ] `prefers-reduced-motion` disables route transitions.
- [ ] Routes are typed; a screen cannot be linked with a typo without a compile error.

## Tasks (ordered)

1. Define `src/router/routes.ts`: route ids, path patterns, parse/build functions, and a typed
   `Route` union.
2. Write `parseHash(hash)` and `buildHash(route)` as pure functions; include query parsing for
   `?tab=` and a `:wordId` segment.
3. Add `useHashRoute()`: subscribes to `hashchange`, exposes `route`, `navigate(route)`, and
   `replace(route)`.
4. Define the guard as a pure `resolveRoute(route, hasProfile)`; wire it to a profile-presence
   signal that feature 05 will supply (until then, a stub that returns `false`).
5. Build `AppShell`: header, back button, title, content slot, focus target.
6. Add focus and scroll reset on route change, respecting reduced motion.
7. Create placeholder screens for routes whose features are not built, each naming its feature.
8. Add the `beforeLeave` veto hook for the session engine.
9. Add a dev-only route table page (`#/__routes`, stripped from production) for manual checks —
   optional, but useful while placeholders exist.

## Tests

**Unit (Vitest):**

- `parseHash` — every route in the table round-trips through `buildHash`; `#/words?tab=wordbook`
  parses the tab; `#/words/w-build` parses the id; unknown paths, empty hash, and `#` fall back.
- `resolveRoute` — no profile → create; profile + valid route → route; profile + unknown → home.
- `beforeLeave` — a vetoing handler keeps the route; no handler allows the change.

**Verification (manual):**

- Open each route directly by URL, reload, and confirm the same screen renders.
- Back/forward through Home → Words → detail → back.
- Unknown hash shows Home, not a blank screen.
- Keyboard focus lands on the heading after navigation.

## Non-goals

- No screen content or data loading.
- No animated page transitions beyond the reduced-motion-safe default.
- No history-based routing (the server cannot rewrite).
