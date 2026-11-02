# Bug 01 — Microsoft redirect sign-in never completes

> Severity: Normal · Status: In review — PR pending
> Reported: 2026-11-02 · Feature: 24 (client online integration)

## Summary

The child clicks "Sign in with Microsoft", signs in at the Microsoft page, and is redirected back
to the app. The redirect response is never applied: the app settles on the sign-in screen again, so
there is no account, no content fetch, and no route out of the gate.

## Environment

- Dev server at `http://localhost:8443/` (`pnpm dev`, React StrictMode on)
- MSAL browser redirect flow (`loginRedirect`), `responseMode` default `fragment`
- Hash routing (`#/signin`, `#/home`, …), redirect URI `http://localhost:8443/`

## Steps to reproduce

1. Open the app signed out and click "Sign in with Microsoft".
2. Complete sign-in at `login.microsoftonline.com`; Entra redirects back to
   `http://localhost:8443/#code=…&state=…`.
3. Wait for the app to settle.

## Expected

The account is read from the redirect response, the token and account are cached, and the app
boots `/v1/content` and `/v1/me` and routes the child to `#/create` or `#/home`.

## Actual

The gate (`SignInScreen`) stays on screen and remains the only route. A reload of the still-signed
in Microsoft session may eventually recover, which makes the failure intermittent rather than
absolute.

## Triage

- Security: not a data-access or credential-issuance failure. No route serves another user's data
  and no token is issued by the app; the defect is that the legitimate response is dropped.
- Severity: **Normal** — sign-in is unusable in development, but there is no data loss and no
  exposure. Fix branch `fix/microsoft-redirect-signin` off `develop`.

## Root cause

Two defects compound in `AuthProvider`:

1. **`handleRedirectPromise` runs on more than one MSAL instance.** The effect creates a
   `PublicClientApplication` each time it runs and calls `initialize()` then
   `handleRedirectPromise()` on it. React StrictMode runs the effect twice in development, so two
   clients race over the same authorization code and request cache. The instance whose result is
   kept in state has already had its redirect hash cleared by the other one, so
   `handleRedirectPromise` resolves `null`; at that moment the account has not been written to the
   cache yet, so `getActiveAccount()` and `getAllAccounts()` are empty and the provider settles on
   `signed-out`. The first instance's successful result is discarded by its effect cleanup.
2. **The default redirect navigation fights hash routing.** With `navigateToLoginRequestUrl` true,
   MSAL does not process the response on the page it lands on; it caches the response hash and
   navigates to the page that started sign-in (`/#/signin`). On that hash-routed page it cannot see
   a server response, so it navigates again (to `/`), and may need another hop before processing.
   Each hop is a full reload that re-runs the race above.

## Fix

- `auth/session.ts` — one single-flight session per config: create the client and run
  `initialize()` → `handleRedirectPromise({ navigateToLoginRequestUrl: false })` once; every
  caller awaits the same promise and reads the same account.
- `navigateToLoginRequestUrl: false` lets the redirect response be applied on the page it lands on.
  The start route is always `#/signin`, and the guard already sends a signed-in user to
  `#/create`/`#/home`, so returning to the requesting route is not needed.
- `AuthProvider` uses the loader instead of constructing a client per effect.

## Regression tests

`page/auth/session.test.ts` (unit tier):

- the redirect is handled with `navigateToLoginRequestUrl: false`;
- two loads with the same config share one client and one `handleRedirectPromise` call, and both
  resolve the same account (the StrictMode race);
- a cached account is used, and made active, when there is no redirect result;
- a different config starts a new session.

## Verification

- `pnpm test` and `pnpm typecheck` (recorded in the fix PR).
- Manual: real Entra redirect sign-in on `http://localhost:8443/` with `pnpm dev`; the app must
  leave the gate without a manual reload.
