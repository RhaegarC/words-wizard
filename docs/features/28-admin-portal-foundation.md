# Feature 28 — Admin Portal Foundation

> Priority: Must · Mission 3 · **Status: Implemented**
> Depends on: 25 (deployment), 26 (roles and identity). Blocks: 29, 30, 31.
> Source of truth: [Mission 3 sprint](00-mission-3-sprint.md) and the
> [portal UI brief](../Portal.md).

## Summary

Stand up the second front-end application and the authorization boundary every later admin feature
uses.

The portal is its own Cloudflare Pages app at **`admin.words.nioh.uk`**, with source under
`src/portal`. It is built and deployed separately from the child app; the existing Worker serves its
API. Deployment stays **two Pages projects and one Worker**.

This feature delivers the shell and the door, not the vocabulary screens:

- the Vite/React app, its dev server on port 8444, its build output, and CI typecheck/build;
- Microsoft Entra sign-in that **reuses the existing app registration** — the same client id,
  scope, and token roles;
- a staff gate: `teacher` and `admin` enter, a signed-in `user` sees Access Denied, anonymous
  callers see sign-in;
- a Worker-side role middleware so every admin route refuses a non-staff caller before any read or
  write;
- a read-only content snapshot the portal loads once and refreshes after each later mutation.

## User story

As a **teacher**, I open `admin.words.nioh.uk`, sign in with the same Microsoft account I use for
Words Wizard, and see an empty-but-ready portal if I'm staff — or a clear Access Denied screen if
I'm not. As an **operator**, no admin operation can be reached anonymously or by a non-staff
account, and the admin bundle never ships to children.

## Design

### Application

- `src/portal` is a React 19 + Vite app with hash routing, a persistent sidebar, and a top bar that
  shows the signed-in email and Sign out.
- Own Vite config: root `portal/`, `base: "./"`, dev and preview port **8444**, build output
  `src/dist-portal` (gitignored). No PWA, no service worker, no locale bundle.
- Own `tsconfig.portal.json`; `pnpm typecheck` includes it. Scripts `dev:portal` and
  `build:portal`; the existing CI `verify` job builds the portal — no new workflow file.
- The portal imports the pure auth modules (`config`, `msal`, `token`, `account`) from the child
  app's auth folder, or from a shared location if they are extracted; it does **not** import the
  child `AuthProvider`, content provider, or outbox.

### Authentication

- Reuses the existing Entra app registration. The operator adds
  `https://admin.words.nioh.uk/` and `http://localhost:8444/` as SPA redirect URIs.
- MSAL: redirect sign-in, silent token first, one redirect on interaction-required. No popup, no
  client secret.
- The portal derives the role from the token's `roles` claim (`admin` > `teacher` > `user`) for UX
  only. The Worker is the enforcement point.

### Authorization

- `requireRole(["teacher", "admin"])` runs after `requireAuth` on every `/v1/admin` route and
  throws a new `forbidden` error (`403`) before any handler body runs.
- The role comes from the verified token claim; `profiles.role` is not consulted.
- `ALLOWED_ORIGINS` gains `https://admin.words.nioh.uk` and `http://localhost:8444`.
- The error handler learns to match parameterised paths (`/v1/admin/topics/:id`) so a wrong method
  returns `405` with `Allow`, not `404`.
- CORS gains `PUT` and `If-Match`.

### Read model

- `GET /v1/admin/content` returns one snapshot: `contentVersion`, `dataset`, every topic and pack
  (archived included), every word (including words in no pack), and the ordered membership.
- `GET /v1/admin/access` returns the caller's role for the shell.
- Both are `Cache-Control: no-store`.

## Acceptance criteria

- [x] `src/portal` builds with `pnpm build:portal` and typechecks with `pnpm typecheck`; CI builds
      it in the existing workflow.
- [x] The portal dev server runs on 8444 against the local Worker on 8787.
- [x] Sign-in uses the existing registration; the portal origin is a registered redirect URI.
- [x] A `teacher` or `admin` token reaches the portal shell; a `user` token shows Access Denied;
      no token shows sign-in.
- [x] Every `/v1/admin` route answers `401` anonymously and `403` for a `user` role, before any
      read or write.
- [x] A wrong method on a parameterised admin path answers `405` with `Allow`.
- [x] `GET /v1/admin/content` returns archived rows and unassigned words; `GET /v1/admin/access`
      returns the role.
- [x] The admin snapshot is never cached.
- [x] The admin bundle is absent from the child app's build.

## Test plan

- **Worker unit** — `src/worker/test/adminAuth.test.ts`: 401/403 on every admin route, teacher and
  admin pass, 405 + `Allow` on parameterised paths, `no-store`.
- **Host tier** — extend `src/worker/test/userData.test.ts` harness in a new
  `src/worker/test/admin.test.ts`: real `wrangler dev`, local D1, local JWKS; token-role
  enforcement and snapshot shape.
- **Portal unit** — route parsing and role derivation; an import-boundary test asserting the
  portal does not import `src/page` app modules.
- **Manual** — sign in at 8444, verify Access Denied with a `user` account, verify the shell and
  navigation; CORS preflight from the portal origin.

## Documentation impact

`docs/develop/portal.md` (new), `docs/develop/worker.md` (admin route table, 403, 405, CORS),
`docs/operations.md` (Entra redirect URIs, second Pages project, `ALLOWED_ORIGINS`), README
(two-Pages topology), PRD (portal and role model).

## Out of scope

Any vocabulary write route or screen (features 29–31); release, drafts, audit; portal offline
support; admin-only capabilities beyond the staff gate.
