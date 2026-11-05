# Login

The page signs in with Microsoft Entra ID using the authorization-code + PKCE redirect flow. The
browser app is public: there is no client secret, and no token is minted by the Worker. This note
describes the workflow end to end, the failure recorded as [bug 02](../bugs/02-token-cache-after-login.md),
and the Entra app-registration changes that fixed it.

## Login workflow

### 1. Build-time configuration

`src/page/auth/config.ts` reads four variables from `src/.env` (local) or the Pages build
environment (production):

| Variable | Meaning |
|---|---|
| `VITE_ENTRA_CLIENT_ID` | the SPA application (client) id |
| `VITE_ENTRA_TENANT_ID` | the tenant id |
| `VITE_ENTRA_SCOPE` | `api://<client-id>/access_as_user` |
| `VITE_API_BASE_URL` | the Worker origin (`http://localhost:8787` locally) |

From them it derives:

- authority — `https://login.microsoftonline.com/<tenant-id>`;
- redirect URI — `<origin>/`, the page root, also used after sign-out;
- scopes — `openid`, `profile`, and the API scope.

A missing or blank value throws `AuthConfigError` naming the key. The provider renders an error
state rather than a sign-in button that cannot work.

### 2. Sign-in

The signed-out route is `#/signin`. Its button calls `signIn`, which runs
`msal.loginRedirect({ scopes })` — a full-page navigation to Entra. MSAL appends its own PKCE
challenge and state; the app never sees the authorization code.

### 3. Redirect back

Entra returns to `<origin>/` with the response in the URL fragment. MSAL validates state, redeems
the code, and writes the account plus ID/access/refresh tokens to `localStorage`
(`cacheLocation: "localStorage"`, so a reload keeps the session).

### 4. Session restore

`src/page/auth/session.ts` handles the return exactly once per page load:

1. `initialize()`;
2. `handleRedirectPromise({ navigateToLoginRequestUrl: false })`;
3. account = the redirect result's account, else the active account, else the first cached
   account;
4. `setActiveAccount(account)`.

Two details are load-bearing:

- **One client per config.** `createSessionLoader` caches the session by a value key of the
  config, so React StrictMode's double mount awaits the same initialization. A second MSAL client
  would race the first for the single-use authorization code and leave the app signed out.
- **No automatic navigation.** The app uses hash routes; MSAL's default "return to the page that
  started sign-in" cannot see its own response through them and costs an extra full reload.
  Disabling it lets the guard route a signed-in account to `#/create` or `#/home`.

The provider narrows the MSAL account with `toAccountLike` and sets `status` to `signed-in`.
`toAccountLike` deliberately keeps `homeAccountId`, `environment`, and `tenantId`: MSAL derives
its token-cache key from them.

### 5. Token acquisition

Screens never touch MSAL. They call `getAccessToken` from the auth context, which
`src/page/auth/token.ts` implements as silent-first:

1. no account → `NoAccountError`;
2. `msal.acquireTokenSilent({ account, scopes })` → access token;
3. `InteractionRequiredAuthError` → `msal.acquireTokenRedirect(...)` and `RedirectingError`;
4. any other error propagates — the caller does not retry blindly.

`src/page/api/client.ts` owns the one retry a `401` earns: it resends the request once with
`forceRefresh: true`; a second `401` calls `onUnauthorized` (back to sign-in) and throws
`ApiError("unauthorized")`.

### 6. Worker verification

Every `/v1/me*` route runs `requireAuth` before its handler. `src/worker/auth.ts`:

1. parses `Authorization: Bearer <jwt>` (scheme case-insensitive);
2. verifies the signature against the tenant's remote JWKS with RS256;
3. requires issuer `…/v2.0`, audience = the client id, and claims `exp`, `oid`, `tid`, `scp`;
4. checks `tid` = configured tenant and `scp` contains `access_as_user`;
5. requires a non-empty `oid`, which becomes the principal.

Any failure is a `401` before the handler runs. `/health` and `/v1/content` stay public.

### 7. Identity claims

`src/worker/auth.ts` reduces the verified token to `{ oid, email, role }`:

- **email** — the `email` claim, else `preferred_username`; a blank or non-string claim is
  `null`. The sync never clears a stored email, so a token without the claim (some personal
  accounts) leaves the last known address in place.
- **role** — the `roles` claim. `admin` beats `teacher`, which beats `user`; an absent or
  unknown claim is `user`.

`ensureUser` runs on **every authenticated request** and syncs both into `users.email` and
`profiles.role`. The token is authoritative in both directions: assigning `admin` promotes the
profile on the next request, and removing it demotes the profile back to `user` the same way.

The lag is in the token, not the database: MSAL caches the access token for up to an hour, so a
role change in Entra does not appear until the cached token expires or is refreshed. Signing out
and back in forces a new token. The old token still verifies, so the old role is not a security
gap — it is the role that token was issued for.

The role authorises nothing yet. It is stored for the planned teacher/admin portal and must not
be used as a UI permission gate before that feature defines what each role may do.

### 8. Sign-out

`signOut` clears the progress provider, loaded content, and the pending outbox, clears the
context account, then calls `msal.logoutRedirect` so the Entra session in that browser ends too.

## The login issue (bug 02)

**Symptom.** Microsoft sign-in completed and Entra redirected back, but the app showed
**"Something went wrong. Try again."** with no API call succeeding.

`boot()` treats a failed content fetch, `/v1/me`, or legacy local-data handling as fatal and
renders `errors.generic`; any unhandled error inside the token path lands there. Two defects sat
on that path.

### Defect 1 — account narrowing dropped the cache key (masking)

`AuthProvider` narrowed `AccountInfo` to `{ localAccountId, idTokenClaims, name, username }`
before passing it to `acquireTokenSilent`. MSAL builds its cache lookup with
`account.homeAccountId.split(".")[1]`, so the missing field produced a `TypeError` before any
network request. `createTokenGetter` only redirects on `InteractionRequiredAuthError`, so the
`TypeError` reached `boot()` and produced the generic screen.

Fixed in PR [#69](https://github.com/RhaegarC/words-wizard/pull/69): `toAccountLike` now preserves
`homeAccountId`, `environment`, and `tenantId`.

### Defect 2 — the app registration exposed no API (blocking)

Once the token request could reach Entra, it still could not succeed. The app registration had:

- no Application ID URI, so `api://<client-id>` did not exist;
- no delegated scope, so `access_as_user` could not be requested;
- v1 access tokens (`requestedAccessTokenVersion: null`), while the Worker requires the v2
  issuer and the client id as audience;
- only the localhost redirect URI, so the production origin was not registered.

Entra rejects the silent request because the resource/scope is not exposed (an
`invalid_scope`-class error). That is why the code fix alone still showed the same screen.

### Resolution

Both had to change: the narrowing fix in code, and the app registration in the tenant. On a
fresh environment, verify the registration before debugging the client — see
[operations.md → Entra ID](../operations.md#entra-id).

## Entra ID configuration changes

Applied to the app registration used by `VITE_ENTRA_CLIENT_ID` (display name `RgLearn`). These
are tenant changes, not repository changes; there is nothing to commit for them.

| Field | Before | After |
|---|---|---|
| `identifierUris` | `[]` | `["api://<client-id>"]` |
| `api.oauth2PermissionScopes` | `[]` | delegated `access_as_user`, enabled, user-consentable |
| `api.requestedAccessTokenVersion` | `null` (v1) | `2` |
| `spa.redirectUris` | `http://localhost:8443/` | `http://localhost:8443/`, `https://words.nioh.uk/` |
| Admin consent | none | granted for `access_as_user` |

The scope entry carries a stable GUID and both admin and user consent text:

```json
{
  "id": "<scope-guid>",
  "value": "access_as_user",
  "type": "User",
  "isEnabled": true,
  "adminConsentDisplayName": "Access Words Wizard",
  "adminConsentDescription": "Allow the app to access the Words Wizard API on behalf of the signed-in user.",
  "userConsentDisplayName": "Access Words Wizard",
  "userConsentDescription": "Allow the app to access the Words Wizard API on your behalf."
}
```

Apply the registration with the Microsoft Graph application PATCH, then grant consent:

```bash
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/<app-object-id>" \
  --body @entra-app.json

az ad app permission grant \
  --id <client-id> \
  --api <client-id> \
  --scope access_as_user
```

Verify before signing in:

```bash
az ad app show --id <client-id> \
  --query '{uris:identifierUris, scopes:api.oauth2PermissionScopes, version:api.requestedAccessTokenVersion, spa:spa.redirectUris}'
```

Expected: `api://<client-id>` in `uris`, an enabled `access_as_user` in `scopes`, `version: 2`, and
both origins in `spa`. A non-interactive probe of the scope also works:

```bash
curl -s -X POST \
  "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/devicecode" \
  -d "client_id=<client-id>&scope=openid profile api://<client-id>/access_as_user"
```

A `200` with a `device_code` means Entra accepts the scope; an `invalid_scope` error means the
registration is still incomplete.

Admin consent may take a short while to appear on the service principal after the grant. The
authoritative check is whether the client can obtain a token for the scope, not the service
principal's cached `oauth2PermissionScopes` list.

### App roles (feature 26)

The profile role comes from the token's `roles` claim, so the application manifest defines three
app roles and an administrator assigns one to each account:

| Value | Purpose |
|---|---|
| `user` | the default; every signed-in account keeps this unless promoted |
| `teacher` | reserved for the planned teacher portal |
| `admin` | reserved for the planned admin portal; wins if several are assigned |

Add them to `appRoles` in the manifest, with `allowedMemberTypes: ["User"]`. An app role only
reaches the token when it is **defined and assigned**; assigning a role that is not in
`appRoles` fails, and defining one without assigning it emits no claim. A token with no `roles`
claim is valid and stores `user`.

```bash
az ad app show --id <client-id> --query appRoles
az ad app update --id <client-id> --set appRoles @app-roles.json
```

Assignments are made on the **Enterprise application → Users and groups** blade, not on the app
registration. Verify a person's effective role by decoding their access token, or by calling
`GET /v1/me` after a fresh sign-in and reading `profile.role`.

## Where to look when sign-in fails

| Stage | Symptom | Check |
|---|---|---|
| Entra redirect | `AADSTS50011` / "redirect URI mismatch" | both SPA redirect URIs registered |
| Token request | generic screen after a valid redirect | Application ID URI, scope, admin consent, v2 token version |
| Token cache | console `TypeError` from MSAL | account passed to `acquireTokenSilent` keeps `homeAccountId` |
| Worker | `401` from `/v1/me` | issuer/audience/tenant vars, `scp` includes `access_as_user` |
| Profile role | `profile.role` stays `user` after promotion | `appRoles` defined and assigned, then a fresh token (MSAL caches for an hour) |
| API client | sign-out loop after a `401` | `EXPECTED_AUDIENCE` and `TOKEN_ISSUER` match the access token |

The relevant code is `src/page/auth/` (`config.ts`, `msal.ts`, `session.ts`, `account.ts`,
`token.ts`, `AuthProvider.tsx`), `src/page/api/client.ts`, and `src/worker/auth.ts`.
