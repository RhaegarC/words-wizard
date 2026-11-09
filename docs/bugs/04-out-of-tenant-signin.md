# Bug 04 — Sign-in fails for an account from another Entra tenant

> Severity: Normal · Status: In progress
> Reported: 2026-11-09 · Feature: 24 (client online integration) and 21 (worker foundation)

## Summary

After the app registration was changed to **Any Entra ID tenant + Personal Microsoft accounts**,
signing in with an account outside the app's home tenant never completes. Entra refuses the request
before the app sees a response:

```
AADSTS50020: User account 'user@outlook.com' from identity provider 'live.com' does not exist in
tenant '<home-tenant>' and cannot access the application '<client-id>'(<app-name>) in that tenant.
The account needs to be added as an external user in the tenant first. Sign out and sign in again
with a different Azure Active Directory user account.
```

The registration change never takes effect, because the request is still addressed to the home
tenant.

## Environment

- SPA authority built from `VITE_ENTRA_TENANT_ID`, set to the app's home tenant (a GUID)
- Worker `EXPECTED_TENANT`, `TOKEN_ISSUER`, and `JWKS_URL` pinned to the same home tenant
- App registration supported account types:
  `AzureADandPersonalMicrosoftAccount` (changed before the report)
- Production page at `https://words.nioh.uk/`, Worker at `https://wordsapi.nioh.uk`

## Steps to reproduce

1. Configure the SPA with `VITE_ENTRA_TENANT_ID=<home tenant id>` and the Worker vars for the same
   tenant.
2. Open the page in a private window and choose **Sign in**.
3. Sign in with a personal Microsoft account, or an organizational account from another tenant.

## Expected

Entra routes the sign-in to the account's home tenant and returns an access token. The page signs
in, and the Worker accepts the token.

## Actual

Entra stops at `AADSTS50020` because the account does not exist in the home tenant, and redirects
back with the error. The page shows the generic sign-in failure. Nothing reaches the Worker.

Even if sign-in succeeded by another route, the Worker would reject the resulting token: it pins
the token's issuer and `tid` to the home tenant.

## Triage

- **Security:** the fix deliberately widens *who may sign in and create a profile*. Authorization
  must not widen with it. In a multi-tenant registration every customer tenant has its own service
  principal for the app, and **that tenant's administrator can assign its own users the app's
  roles**. A `roles` claim in a token issued by another tenant is therefore that tenant's decision,
  not the home tenant's. The verifier must keep trusting roles only from `EXPECTED_TENANT`; a
  token from any other tenant is accepted as `user`, reaches only its own `/v1/me` data scoped by
  `oid`, and gets `403` on every `/v1/admin` route. No existing row becomes readable to another
  account, and no foreign tenant can grant itself the admin portal.
- **Severity:** Normal — sign-in is impossible for exactly the accounts the registration was
  changed to admit, with no exposure and no server-side corruption. It takes the `fix/*` path.

## Root cause

Two independent single-tenant assumptions. Both must change; fixing one alone leaves the report
unresolved.

1. **Client authority.** `src/page/auth/config.ts` builds
   `https://login.microsoftonline.com/<tenant-id>` from `VITE_ENTRA_TENANT_ID`. With a GUID in
   that variable, MSAL asks Entra to sign the account into that tenant only. Entra evaluates the
   account there and answers `AADSTS50020` before the multi-tenant registration matters.
2. **Worker verifier.** `src/worker/auth.ts` passes `TOKEN_ISSUER` to `jose` as the exact `iss`
   and then requires `tid` to equal `EXPECTED_TENANT`. A token from any other home tenant —
   including the personal Microsoft account tenant
   `9188040d-6c67-4c5b-b112-36a304b66dad` — is rejected with `401`. `JWKS_URL` is the home
   tenant's key set, which cannot verify those tokens either.

## Fix

- **Client:** set `VITE_ENTRA_TENANT_ID=common`, producing the authority
  `https://login.microsoftonline.com/common`. No client code change is needed; `common` is the
  value for any Entra tenant plus personal accounts, and `.env.example` now shows it.
- **Worker:** the **common issuer template** selects multi-tenant mode. `TOKEN_ISSUER` becomes
  `https://login.microsoftonline.com/common/v2.0` and `JWKS_URL` the shared key set
  `https://login.microsoftonline.com/common/discovery/v2.0/keys`. `EXPECTED_TENANT` keeps its
  meaning: **the home tenant** the app belongs to.
  - Configuration refuses a common issuer with a tenant-specific key set (`config_missing` naming
    `JWKS_URL`), and refuses a home tenant that is not a GUID, because `common` is an authority,
    not a tenant.
  - The verifier omits the exact-issuer check, then requires `tid` to be a GUID and `iss` to equal
    the template with `common` replaced by that `tid`. Signature, audience, algorithm, expiry,
    required-claim, `scp`, and `oid` checks are unchanged.
  - **Roles are honoured only when `tid` equals `EXPECTED_TENANT`.** A token from any other tenant
    resolves to `user` whatever its `roles` claim says, so a customer tenant's administrator cannot
    assign themselves the admin portal.
  - Single-tenant mode is unchanged: a `TOKEN_ISSUER` naming one tenant still accepts only that
    tenant.
- Docs, the environment example, and the Worker config template updated to match.

## Regression tests

- `src/worker/test/auth.test.ts` — a multi-tenant verifier accepts tokens from an arbitrary home
  tenant and from the personal Microsoft account tenant; rejects a non-GUID `tid`, a literal
  `common` issuer, an issuer that disagrees with `tid`, a v1/shadow issuer, a missing scope, a
  wrong audience, and a missing `oid`. A `roles: ["admin"]` claim from a foreign tenant resolves
  to `user`, while the same claim from the home tenant resolves to `admin`. Single-tenant
  rejection of another tenant stays covered.
- `src/worker/test/config.test.ts` — a common issuer selects multi-tenant mode; a common issuer
  with a tenant-specific JWKS URL, or with a non-GUID home tenant, is a `ConfigError` naming that
  key.
- `src/page/test/auth/config.test.ts` — `VITE_ENTRA_TENANT_ID=common` produces the `common`
  authority.
- `src/page/test/scripts/deployment-config.test.ts` (doc assertion) — `.env.example` documents
  `common`.

## Verification

Recorded in the pull request: `pnpm typecheck`, the full `pnpm test` run, `pnpm build`,
`pnpm build:portal`, and `pnpm check:dist`.
