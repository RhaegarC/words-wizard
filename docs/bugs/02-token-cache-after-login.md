# Bug 02 — Token acquisition fails after a successful sign-in

> Severity: Normal · Status: Fixed — PR [#69](https://github.com/RhaegarC/words-wizard/pull/69) merged
> 2026-11-04, plus a tenant configuration change outside the repository
> Reported: 2026-11-04 · Feature: 24 (client online integration)

## Summary

The child signs in with Microsoft, Entra redirects back, and the app leaves the sign-in screen —
but the first authenticated boot fails and the page shows **"Something went wrong. Try again."**
The account and its redirect response are valid; the failure is the silent token request that
follows.

## Environment

- Dev server at `http://localhost:8443/` (`pnpm dev`) and the production Pages build
- `@azure/msal-browser` 5.27, redirect flow, response mode `fragment`
- Worker at `http://localhost:8787` with the tenant, audience, and scope configured
- Hash routing (`#/signin`, `#/home`, …) with the redirect URI `<origin>/`

## Steps to reproduce

1. Open the app signed out and click "Sign in with Microsoft".
2. Complete sign-in at `login.microsoftonline.com`; Entra redirects back.
3. Wait for the app to boot.

## Expected

The redirect response supplies the account, the app acquires an access token silently, and boot
loads `/v1/content` and `/v1/me` and routes to `#/create` or `#/home`.

## Actual

The account is restored and the sign-in screen is left, but boot stops with the generic retry
screen. The browser console shows a `TypeError` from MSAL rather than an authentication error.

## Triage

- Security: not a data-access failure. The token request never reaches the Worker, so no route is
  called without a credential and no data is exposed. The defect is that the redirect's cached
  credentials cannot be found.
- Severity: **Normal** — sign-in is unusable after the redirect, but there is no data loss and no
  exposure. Fix branch `fix/token-account-cache-keys` off `develop`.

## Root cause

Two independent defects sat on the same path. The code defect failed first and hid the second;
fixing it exposed the tenant configuration that made sign-in unusable either way.

### 1. Tenant configuration — the blocking defect

The Entra app registration (`RgLearn`, the client id in `VITE_ENTRA_CLIENT_ID`) exposed no API:

- `identifierUris` was `[]`, so `api://<client-id>` did not exist;
- `api.oauth2PermissionScopes` was `[]`, so `access_as_user` could not be granted;
- `api.requestedAccessTokenVersion` was `null` (v1 tokens), while the Worker requires the v2
  issuer and the client id as `aud`;
- the SPA redirect list held only `http://localhost:8443/`, not `https://words.nioh.uk/`.

A redirect sign-in therefore succeeded, but the silent request for
`api://<client-id>/access_as_user` could never be satisfied: Entra rejects a resource or scope
the app does not expose (an `invalid_scope`-class error, e.g. `AADSTS500011`/`AADSTS65005`).
`createTokenGetter` does not treat that as an interaction-required error, and `boot()` renders
`errors.generic`. **No client change can fix this**; the registration must be corrected.

### 2. Account narrowing — the masking defect

`AuthProvider` narrowed MSAL's `AccountInfo` to the app's `AccountLike` before handing it to
`createTokenGetter`, and the narrowing kept only `localAccountId`, `idTokenClaims`, `name`, and
`username`. The token getter passes that object straight back to
`msal.acquireTokenSilent({ account, scopes })`.

MSAL builds the cache key from the account: `SilentFlowClient.acquireCachedToken` calls
`BrowserCacheManager.generateAccountKey(account)`, which does
`account.homeAccountId.split(".")[1]`. With the ID dropped by the narrowing, that is
`undefined.split`, so the SDK throws a `TypeError` instead of returning the cached access token or
an `InteractionRequiredAuthError`. `createTokenGetter` only redirects on the latter, so the
`TypeError` propagates to `boot()`, which sets `bootFailed` and renders `errors.generic`.

`environment` and `tenantId` matter for the same lookup: MSAL matches cached credentials by them.

Because the cache lookup runs before the network request, the `TypeError` was the first failure
observed. Correcting the narrowing let the request proceed to Entra, where the missing scope
still failed — the "still the same" report after the code fix. Both had to be fixed.

## Fix

- Tenant (outside the repository): set the Application ID URI to `api://<client-id>`, add the
  enabled delegated `access_as_user` scope, set `requestedAccessTokenVersion: 2`, add
  `https://words.nioh.uk/` alongside the localhost redirect URI, and grant admin consent.
  Recorded as a checklist in [operations.md → Entra ID](../operations.md#entra-id).
- `auth/account.ts` — the narrowing now lives here as `toAccountLike` and preserves
  `homeAccountId`, `environment`, and `tenantId` alongside the identity fields the UI uses.
- `auth/AuthProvider.tsx` — uses `toAccountLike` for both the context account and the token
  source, so the object MSAL receives can resolve its own cache entry.

## Regression tests

`page/test/auth/account.test.ts` (unit tier):

- the converted account keeps `homeAccountId`, `environment`, and `tenantId`;
- the identity helpers still read the `oid` and display name from it;
- a null account still narrows to null.

## Verification

- `pnpm test` — 757 passed, 5 skipped (container-tagged tiers), after the code fix.
- `pnpm typecheck` and `pnpm build`/`pnpm check:dist` — clean.
- Tenant: `az ad app show` now reports the identifier URI, the enabled `access_as_user` scope,
  `requestedAccessTokenVersion: 2`, and both redirect URIs. A device-code request for
  `api://<client-id>/access_as_user` returns `200` with a device code, proving Entra accepts the
  scope.
- Diagnostics ruled out the rest of the path: `GET /v1/content` returns `200`, `/health` returns
  `200`, and `/v1/me` answers `401` with the correct CORS headers to a tokenless caller.
- Manual end-to-end: restart both dev servers, clear site data for `http://localhost:8443/`, and
  sign in; the app must leave the gate and reach `#/create` or `#/home`. This is the final check
  after the tenant change.
