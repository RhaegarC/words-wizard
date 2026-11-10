# Bug 05 — Admin portal signs in personal and other-tenant accounts

> Severity: Normal · Status: In review — PR [#96](https://github.com/RhaegarC/words-wizard/pull/96)
> Reported: 2026-11-10 · Feature: 28 (admin portal foundation)

## Summary

The admin portal inherits the child app's multi-tenant authority. Signing in with a personal
Microsoft account completes the Entra redirect, then lands on **"You don't have access to the
admin portal."** An account from any other Entra tenant reaches the same dead end.

The portal is staff-only: a teacher or administrator is a member of the home tenant with one of
its app roles. Accounts outside that tenant can never be staff — the Worker deliberately trusts
the `roles` claim only from `EXPECTED_TENANT` — so the portal should not offer them sign-in at
all. It should ask Entra for the home tenant, and let Entra refuse everyone else.

## Environment

- Admin portal at `http://localhost:8444` (`pnpm dev:portal`)
- Worker at `http://localhost:8787`
- Shared `src/.env`: `VITE_ENTRA_TENANT_ID=common`
- Worker `EXPECTED_TENANT` set to the home tenant id
- The same Entra SPA registration as the child app, redirect URI `http://localhost:8444/`
  registered

## Steps to reproduce

1. Configure `src/.env` as for the child app, with `VITE_ENTRA_TENANT_ID=common`.
2. Start the Worker and the portal, then choose **Sign in with Microsoft**.
3. Sign in with a personal Microsoft account, or an organizational account from another tenant.

## Expected

The portal addresses Entra with the **home tenant**. A personal or other-tenant account is
refused by the identity provider and no token is issued. Access Denied remains for a home-tenant
member who has no `teacher`/`admin` app role.

## Actual

Sign-in completes. The resulting access token has `tid` = the personal Microsoft account tenant
`9188040d-6c67-4c5b-b112-36a304b66dad` and no `roles` claim. The portal decodes the token,
decides the role is `user`, and renders Access Denied.

The last network call is the token endpoint because the client short-circuits on a `user` role
and never calls `GET /v1/admin/access`; the redirect result *was* handled. Nothing reaches the
Worker.

## Triage

- **Security:** no data is exposed and no role is granted. The Worker still rejects the token
  from every admin route, and the bug 04 rule still holds: roles from a foreign tenant are
  ignored. The defect is that the portal *offers* sign-in to accounts it can never authorize and
  relies on the role gate instead of the tenant boundary. Restricting the authority adds that
  boundary at the identity provider, before a token exists.
- **Severity:** Normal — no exposure or corruption; it is a gate that admits the wrong callers
  to a screen that then refuses them. It takes the `fix/*` path.

## Root cause

`src/portal/auth.ts` built its configuration with `authConfigFromEnv`, the child app's loader.
The portal therefore read the shared `VITE_ENTRA_TENANT_ID` (`common`) and produced the authority
`https://login.microsoftonline.com/common`, which is by design open to any Entra tenant and
personal Microsoft accounts. The portal had no tenant of its own.

## Fix

- **A portal-only build-time value.** `VITE_PORTAL_ENTRA_TENANT_ID` names the **home tenant**.
  `readPortalConfig` reads it, requires a GUID (so `common`, `organizations`, `consumers`, and
  domain names are refused with a `config` error naming the key), and uses it for the MSAL
  authority. The child app's `VITE_ENTRA_TENANT_ID` is ignored by the portal and stays `common`
  for the child app.
- **The error is named.** `AuthConfigError` distinguishes a missing value from an invalid one,
  and the portal's "not configured" card shows the same key either way.
- **Docs and the example environment** describe the new value for local development, the admin
  Pages project, and the Entra registration. The portal reads the child app's other variables
  unchanged.

## Regression tests

- `src/portal/test/config.test.ts` — the portal authority is the home tenant, not the shared
  `common`; it works without `VITE_ENTRA_TENANT_ID`; a missing or blank portal tenant is a
  `config` error naming `VITE_PORTAL_ENTRA_TENANT_ID`; `common`, `organizations`, `consumers`,
  and a domain name are refused; a missing shared value is still named. No test uses a real
  tenant or client id.

## Verification

- `pnpm typecheck` — clean.
- `pnpm test` — 78 files passed, 1 skipped; 1077 tests passed, 5 skipped (the skip is the
  credential-gated remote tier).
- `pnpm build`, `pnpm build:portal`, `pnpm check:dist` — pass.
