# Bug 03 — Saving a finished session fails for a real Entra oid

> Severity: Normal · Status: Fixed — PR [#78](https://github.com/RhaegarC/words-wizard/pull/78) merged
> Reported: 2026-11-05 · Feature: 24 (client online integration) and 23 (user-data API)

## Summary

After a practice session ends, the commit to `POST /v1/me/sessions` is refused with
`422 validation_failed` and the child sees the session could not be saved. Nothing is written to
D1. The client payload is well formed; the server rejects it because the session id is longer than
its validation allows.

Reported payload: [`docs/develop/payload.json`](../../develop/payload.json) (a local debugging
artefact, deliberately not committed).

## Environment

- Signed-in identity whose `oid` is a GUID (`ccb380dd-25b7-43ea-a371-6b2ffe52cfcd`)
- Dev server at `http://localhost:8443/` against the local Worker; content version `0.4.0`
- A daily session that finished with 5 words and 25 XP

## Steps to reproduce

1. Sign in and finish a practice session.
2. Let the client commit the session.

## Expected

`POST /v1/me/sessions` answers `200`, the session row and its progress rows are written, and the
summary screen reports the session saved.

## Actual

The request is rejected with `422 validation_failed`. The payload is otherwise valid — every
field passes except the session id.

## Triage

- Security: not a data-access or credential failure. No route runs before validation and nothing is
  written on rejection.
- Severity: **Normal** — the practice loop cannot persist a finished session for a real account,
  but there is no exposure and no server-side corruption. The report is a real observable defect,
  so the fix takes the `fix/*` path off `develop`.

## Root cause

The client composes the session id in `src/shared/session.ts` as:

```
<profileId>:<kind>:<localDate>:<startedAt>
```

The API provider's profile id is the token's `oid`, a 36-character GUID. A daily session therefore
produces a 67-character id and a monthly one 69 characters:

```
ccb380dd-25b7-43ea-a371-6b2ffe52cfcd:daily:2026-11-05:1793875028539   (67)
```

`validateServerSessionPayload` capped `session.id` at 64 characters
(`MAX_SESSION_ID_LENGTH`), so every commit from a real GUID account failed with
`session-id-invalid`. The unit tests only ever used short ids such as `session-1`, so the boundary
was never exercised with the shape the client actually builds.

## Fix

Raise `MAX_SESSION_ID_LENGTH` to **128** in `src/shared/sessionPayload.ts`, with a comment recording
why: the client's id already embeds a 36-character oid plus the kind, date, and start timestamp.
The bound still rejects an unbounded field, and the `sessions.id` column is `TEXT`, so no schema
change is needed. The client's own payload validator does not duplicate the length rule.

## Regression tests

`src/shared/test/sessionPayload.server.test.ts` (unit tier):

- accepts a daily and a monthly id built from a 36-character GUID oid;
- the boundary test now accepts 128 characters and rejects 129.

The first test failed before the fix with `expected [ 'session-id-invalid' ] to not include
'session-id-invalid'`, confirming RED for the reported reason.

## Verification

- The reported payload validates with no issues after the fix (checked against
  `docs/develop/payload.json` in a throwaway test; the file is not committed).
- `pnpm test` — 858 passed, 5 skipped (remote credential-gated).
- `pnpm typecheck` — clean.
