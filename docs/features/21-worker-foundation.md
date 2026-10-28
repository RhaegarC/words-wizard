# Feature 21 — Worker Foundation & Entra Token Validation

> Priority: Must · Mission 2 · **Status: Planned — documentation only**
> Depends on: Phase 0 (repository restructure). Blocks: 22, 23.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md).

## Summary

Stand up the API edge. This feature creates the Cloudflare Worker (Hono on TypeScript), its
configuration contract, CORS policy, error envelope, public health route, and the Microsoft Entra ID
token verifier. It stores no application data yet. Every later route is added behind the identity
boundary this feature establishes.

The Worker is the only component that validates tokens. The SPA obtains one with MSAL and sends it
as `Authorization: Bearer <token>`; no cookie, query-string token, or client-asserted user id is
accepted.

## User story

As a **signed-in child**, my request is tied to my Entra identity and no one else's. As an
**operator**, a missing or wrong configuration stops the API from serving anything rather than
silently falling back to anonymous access.

## Acceptance criteria

### Runtime and configuration

- [ ] `src/worker/index.ts` exports a Hono app as the Worker's `fetch` handler; it compiles under
      `tsconfig.worker.json` and runs with `wrangler dev`.
- [ ] Configuration is read from Worker vars through one module (`src/worker/config.ts`):
      `JWKS_URL`, `TOKEN_ISSUER`, `EXPECTED_AUDIENCE`, `EXPECTED_TENANT`, and `ALLOWED_ORIGINS`
      (comma-separated). Values are validated once per isolate and cached.
- [ ] A missing or blank required var makes the request fail with a `500` in the error envelope,
      and the log line names the missing key. The failure does not bypass Hono's error handler, and
      there is no anonymous or permissive fallback.
- [ ] `JWKS_URL`, issuer, audience, and tenant are configuration, never hard-coded, so the verifier
      can point at a local JWKS server in tests.
- [ ] `src/worker/wrangler.jsonc` names the Worker, the `DB` D1 binding (unused until feature 22),
      the `wordsapi.nioh.uk` custom domain (activated in feature 25), and the vars above as
      non-secret configuration.
- [ ] `drizzle.config.ts` points at `src/worker/db/schema.ts` and `src/worker/drizzle/`; feature 21
      creates an empty schema module so the config resolves, and features 22–23 add the tables.
- [ ] `pnpm worker:typecheck` exists and runs in CI.

### Public surface and errors

- [ ] `GET /health` returns `200` with `{ "ok": true }`, no authentication, and `Cache-Control:
      no-store`. Feature 22 adds `contentVersion` once D1 holds content.
- [ ] Unknown routes return `404` and known paths with a wrong method return `405`, both in the
      error envelope.
- [ ] Every error response is `{ "error": { "code": string, "message": string } }`. Codes are
      stable identifiers (`unauthorized`, `config_missing`, `not_found`, `method_not_allowed`,
      `internal`); messages are safe for a client and leak no stack trace, var value, or token.
- [ ] An unexpected handler exception becomes `500 internal` with a generic message; details go to
      `console.error`, never to the response.

### CORS

- [ ] Only exact origins listed in `ALLOWED_ORIGINS` receive `Access-Control-Allow-Origin`:
      `https://words.nioh.uk` and `http://localhost:8443` by default. There is no wildcard.
- [ ] `Access-Control-Allow-Methods` is `GET,POST,PATCH,OPTIONS`;
      `Access-Control-Allow-Headers` is `Authorization, Content-Type, If-None-Match`;
      `Access-Control-Max-Age` is set; `Access-Control-Allow-Credentials` is absent.
- [ ] `OPTIONS` from an allowed origin returns `204` without requiring a token. `OPTIONS` from an
      unlisted origin returns `204` without CORS headers, so the browser blocks the real request.
- [ ] Responses vary on `Origin`.

### Token validation

- [ ] Only `Authorization: Bearer <jwt>` is accepted. Cookies and query parameters are ignored.
- [ ] The signature is verified with `jose`'s `createRemoteJWKSet` against `JWKS_URL`, with
      `algorithms: ["RS256"]` and a 60-second clock tolerance.
- [ ] Issuer must equal `TOKEN_ISSUER` exactly; audience must equal `EXPECTED_AUDIENCE`; the `tid`
      claim must equal `EXPECTED_TENANT`; `scp` must contain `access_as_user`. A v1 token, a token
      from another tenant, or a token minted for another API is rejected.
- [ ] `exp` and `nbf` are enforced; an expired or not-yet-valid token is rejected.
- [ ] A missing, malformed, non-Bearer, or badly signed token returns `401 unauthorized` with
      `WWW-Authenticate: Bearer` and no CORS-dependent body leakage.
- [ ] The authenticated principal is the `oid` claim, exposed to handlers as a typed context value.
      No request body, path parameter, or header may choose the user key.
- [ ] Token verification is a pure function with an injectable JWKS resolver, so every rejection
      path runs offline against a locally minted RSA key pair.

## API surface in this feature

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | public | `{ ok: true }` |
| OPTIONS | any | public | `204` + CORS |

Protected routes begin in feature 23. The verifier and middleware are exercised directly by tests
until then; no placeholder product route is added.

## Tasks (ordered)

1. Add `hono`, `jose`, and `wrangler` (dev dependency); add `worker:dev`, `worker:typecheck`, and
   `worker:deploy` scripts. Keep pnpm commands rooted at `src/`.
2. Write `config.ts` with the fail-fast contract and its unit tests.
3. Add the error envelope helper and Hono `onError` / `notFound` handlers.
4. Add the CORS middleware with exact-origin matching and the `OPTIONS` shortcut.
5. Implement the JWKS-backed verifier: algorithm pinning, issuer, audience, tenant, scope, clock
   tolerance, and `oid` principal. Inject the JWKS resolver for tests.
6. Add the auth middleware that returns `401` before any handler runs and sets the principal in
   context.
7. Wire `/health` and the 404/405 behaviour into the Hono app.
8. Add `wrangler.jsonc` and `drizzle.config.ts`; confirm `wrangler dev` boots locally without a D1
   database.
9. Wire `worker:typecheck` into CI; keep the existing page checks unchanged.
10. Record the production Entra values (tenant id, client id, issuer, JWKS URL, scope) in
    `docs/operations.md` when feature 25 creates it; until then keep them in the feature 25 task
    list, not in code.

## Tests

| Tier | What it proves |
|---|---|
| **Unit** (always) | Config rejects each missing/blank key and names it. CORS allows/denies exact origins and handles preflight. Error envelope shape and status mapping. Token matrix: valid, missing, malformed, non-Bearer, expired, `nbf` in the future, wrong signing key, `alg: none` / HS256, wrong issuer, wrong audience, wrong `tid`, missing `access_as_user`, extra scope accepted, `oid` extracted. Handler context cannot be spoofed by a body field. |
| **Host** (always) | `wrangler dev` boots with the test vars; `/health` is `200`; an unlisted origin gets no `Access-Control-Allow-Origin`; an allowed `OPTIONS` is `204`; unknown route is a `404` envelope; a blank required var produces `500 config_missing` naming the key. No database is opened. |
| **Manual** (per environment) | A real Entra access token from the tenant is accepted; a token from another tenant or a tampered signature is rejected. Recorded in `docs/operations.md`. |

**RED-first hot spots**

- Every rejection path in the token matrix, written before the verifier.
- The "body cannot choose the user" assertion, written before any handler accepts a body.
- The fail-fast config test, written before config parsing exists.

The local JWKS server is a double for **token validation only**. It proves our verifier rejects and
accepts the claims it should; it cannot prove Entra issues tokens. Real issuance is the manual check
above, and that limitation is stated rather than hidden.

## Non-goals

- No content, profile, progress, or metrics storage.
- No roles, admin authorization, rate limiting, or abuse protection.
- No refresh-token handling on the server; MSAL owns the browser session.
- No logging pipeline or analytics; `console.error` is the only diagnostic.
- No branch preview environment or GitHub deploy secret.
