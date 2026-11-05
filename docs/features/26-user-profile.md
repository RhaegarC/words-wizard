# Feature 26 — User Profile, Email & Role Sync

> Priority: Should (prerequisite for Mission 3 roles) · Mission 2 · **Status: Not started —
> design locked**
> Depends on: 23 (user-data API), 24 (client online integration), 25 (deployment and domains)
> Blocks: the Mission 3 role-gated portal.
> Source of truth: [Mission 2 sprint](00-mission-2-sprint.md) and [PRD](../PRD.md) §8.3.

## Summary

Give the signed-in user a face and an account identity, and make the verified token the single
source of `email` and `role`.

- `users` gains a nullable `email`, written from the access token on every authenticated request.
- `profiles` gains `role` (`user`, `teacher`, `admin`, default `user`) and `user_avatar_key`, an
  optional R2 object key for the user's own photo.
- The signed-in shell shows a **display-only** top-right chip: the uploaded photo (or initials)
  and the display name. It is not clickable; the existing sidebar mini-profile stays the route
  into Settings.
- Settings gains photo upload, preview, and removal. A successful profile save returns to
  `#/home`.
- The buddy stays untouched: `profiles.avatar` and the `avatars`/`avatar_stages` catalogue remain
  the eight built-in buddies, and `profiles.characterName` remains the child's display name.

Role is stored for the future Mission 3 portal. This feature does **not** authorize anything with
it, show it, or let a client write it.

## User story

As a **signed-in child**, I can see my own name and photo at the top right, and I can change my
display name and photo in Settings. As a **product owner**, every account's email and role are
derived from the verified Microsoft token rather than typed into the app, so the values the
Mission 3 portal will trust are already consistent.

## Data model

Migration `worker/drizzle/0003_user_profile.sql`, generated from `worker/db/schema.ts`.

```sql
-- users: identity-level, token-derived
ALTER TABLE users ADD COLUMN email TEXT;

-- profiles: one row per user (user_id is the primary key)
ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'teacher', 'admin'));
ALTER TABLE profiles ADD COLUMN user_avatar_key TEXT;
```

Rules:

- `users.email` is nullable. A token that carries neither `email` nor `preferred_username` stores
  nothing, and an existing value is never cleared by a later token without one. No unique index:
  Entra identities are unique, email aliases are not.
- `profiles.role` is `NOT NULL` with a check constraint. Existing rows receive `user`; the database
  refuses any other value.
- `profiles.user_avatar_key` is nullable. It is an R2 object key, never a public URL.
- `profiles.avatar` (buddy id) is unchanged, as are `avatars`, `avatar_stages`, and
  `characterName`.
- If `drizzle-kit` generates a table rebuild for the check constraint, the migration must copy all
  profile rows and preserve the `users` foreign key. The database tier asserts row count and values
  survive.

## Token mapping and synchronisation

The access token is verified by `worker/auth.ts` before any handler runs. Two claims are read:

| Column | Claim | Rule |
|---|---|---|
| `users.email` | `email`, else `preferred_username` | Trim; accept only a non-empty string. Prefer `email`; fall back to `preferred_username`. Never read a body or query value. |
| `profiles.role` | `roles` | `roles` is an array of app-role values. If it contains `admin` → `admin`; else `teacher` → `teacher`; else `user`. Absent, malformed, or unknown values → `user`. |

`Principal` becomes `{ oid, email, role }`. The verifier returns it; routes never re-parse the
token.

Synchronisation rules:

- Every authenticated `/v1/me*` request calls `ensureUser`. It updates `users.email` and, when a
  profile exists, `profiles.role`.
- Writes are conditional: only when the stored value differs. A GET is not a write on every call.
- A missing email never overwrites an existing one; a missing/unknown role resolves to `user` and
  does overwrite an elevated role (token is authoritative).
- `POST /v1/me/profile` sets `role` from the principal when it creates the row.
- The client cannot write `email`, `role`, or `user_avatar_key`; unknown profile fields are already
  rejected by `worker/profileInput.ts`.
- Role changes in Entra take effect on the next fresh access token. MSAL caches tokens, so the row
  may lag until the token refreshes or the user signs in again. This is documented, not worked
  around with a forced refresh on every request.

Entra prerequisite: the registration defines and assigns app roles `user`, `teacher`, and `admin`.
Unassigned users get no `roles` claim and therefore `user`. See
[login.md](../develop/login.md).

## API

### `GET /v1/me`

The response keeps its shape and adds two profile fields plus a user-level email:

```json
{
  "profile": {
    "name": "Mia",
    "characterName": "Mia",
    "avatar": "fox",
    "role": "teacher",
    "userAvatarKey": "avatars/7f.../0c9....webp",
    "...": "existing fields unchanged"
  },
  "email": "mia@example.com",
  "progress": [],
  "metrics": [],
  "introductions": []
}
```

- `email` is top-level because the user row exists before a profile does; it is `null` when the
  token supplied nothing.
- `role` and `userAvatarKey` live on the profile because they are profile columns.
- `userAvatarKey` is returned instead of a URL. The page composes the URL (below), so the bucket
  domain is configuration, not data.

### `POST /v1/me/avatar`

- Authenticated; requires an existing profile.
- `multipart/form-data` with exactly one `file` field.
- Limits: 2 MiB maximum, JPEG/PNG/WebP only, verified by magic bytes rather than the declared
  `Content-Type`. The declared `Content-Length` is checked before the body is parsed.
- Object key: `avatars/<oid>/<uuid>.<ext>`, where the extension follows the detected type.
- The object is written with its detected `Content-Type` and
  `Cache-Control: public, max-age=31536000, immutable`.
- On success the profile row is updated to the new key, then the previous object is deleted
  best-effort. If the row update fails, the newly uploaded object is deleted best-effort.
- Response `200 { "key": "avatars/<oid>/<uuid>.<ext>" }`.
- Errors: `401 unauthorized` before touching R2; `404 profile_not_found`; `422 validation_failed`
  for oversize, wrong type, or a missing file. Storage failure is `500 internal` and logged.

### `DELETE /v1/me/avatar`

- Authenticated; idempotent. Clears `profiles.user_avatar_key`, then deletes the object
  best-effort.
- Returns `204` even when no key was set.
- The top-right chip falls back to initials.

### `GET /v1/avatars/*`

- **Public**, like `/v1/content`; an `<img>` cannot send a Bearer token.
- The path after `/v1/avatars/` is the full R2 key (`avatars/<oid>/<uuid>.<ext>`). The Worker reads
  the object and returns its bytes with the stored content type and
  `Cache-Control: public, max-age=31536000, immutable`.
- Unknown key → `404 not_found`.
- In production the page normally uses the public bucket domain instead; this route exists for
  local development and as a fallback.

### Route and CORS plumbing

- `worker/app.ts` `ROUTES` gains `/v1/me/avatar: ["POST", "DELETE"]`; `/v1/avatars/*` is public and
  registered beside `/v1/content`.
- `worker/cors.ts` adds `DELETE` to `ALLOWED_METHODS`.
- `WorkerEnv` gains `AVATARS?: R2Bucket`, where `R2Bucket` is a minimal local interface
  (`get`, `put`, `delete`) declared in `worker/r2.ts`. It mirrors `worker/db/d1.ts`, so the Worker
  gains no `@cloudflare/workers-types` dependency. A `requireAvatars(env)` helper mirrors
  `requireDb`, and a missing binding is `ConfigError("AVATARS")`.

## R2 and configuration

| Piece | Value |
|---|---|
| Bucket | `words-wizard-avatars` |
| Worker binding | `AVATARS` in `worker/wrangler.jsonc` (`r2_buckets`) |
| Production public base | `https://avatars.nioh.uk` (custom domain on the bucket) |
| Local public base | `http://localhost:8787/v1/avatars` |
| Page env | `VITE_AVATAR_BASE_URL`, optional; defaults to `${VITE_API_BASE_URL}/v1/avatars` |

Operator steps:

```bash
cd src
pnpm exec wrangler r2 bucket create words-wizard-avatars
pnpm exec wrangler r2 bucket domain add words-wizard-avatars \
  --domain avatars.nioh.uk --zone-id <zone-id>
```

- Public access is read-only via the custom domain; uploads and deletes happen only through the
  Worker's R2 binding. No R2 credentials reach the browser.
- Local `wrangler dev` creates an isolated local R2 store; the public Worker route makes those
  objects visible at `http://localhost:8787/v1/avatars/...`.
- The bucket is dedicated to avatars; a future word-artwork bucket stays separate.
- `VITE_AVATAR_BASE_URL` is page configuration, not a secret. Production sets it to the custom
  domain; local leaves it unset and uses the Worker route.

## Client

### Types and boot

- `shared/me.ts`: `ServerProfile` gains `role: Role` and `userAvatarKey: string | null`;
  `MeResponse` gains `email: string | null`. Export a `Role` union.
- `shared/types.ts`: `Profile` gains `role` and `userAvatarKey`.
- The boot mapper spreads the server profile, so the new fields reach every screen.
- Email is carried in the boot state for future use; no screen renders it.

### Avatar URL

A small helper composes `base + "/" + key`:

- base = `VITE_AVATAR_BASE_URL` when set;
- else `${VITE_API_BASE_URL}/v1/avatars`;
- `null` key → `null`.

The key is server-generated and restricted to `[a-z0-9/._-]`, so no per-segment encoding is
required; the helper still rejects a key containing `..` or a leading slash.

### Top-right chip

- `AppShell` gains a slim top bar above the content slot.
- Right-aligned, display-only (`<div>`, not a `<button>` or link):
  - `<img>` from the composed avatar URL when `userAvatarKey` is set;
  - otherwise an initials tile from `profile.name` (first character, uppercase);
  - the display name beside it.
- Present on every shell screen, including sessions.
- The sidebar `mini-profile` is unchanged and remains the Settings entry.

### Settings

The existing profile form gains a photo control:

- File input accepting `image/jpeg`, `image/png`, `image/webp`.
- A local preview from `URL.createObjectURL` (revoked on unmount/change).
- A "Remove photo" control when a photo exists.
- No client-side resize or crop; the Worker enforces 2 MiB.

Save flow (one button, existing form):

1. Validate the display name with `validateCharacterName` (1–16 characters, unchanged).
2. If a new file is selected: `POST /v1/me/avatar` with `FormData`.
3. Else if removal was chosen: `DELETE /v1/me/avatar`.
4. `PATCH /v1/me/profile` with `characterName` (and the existing buddy `avatar` when changed).
5. On success, update the boot profile and `navigate({ id: "home" })`.
6. On failure, stay on Settings and show the existing save-error treatment. A photo upload that
   succeeded before the PATCH is not rolled back; the error message says the photo was saved but
   the name was not.

The upload uses the same 401 refresh-and-retry rule as `page/api/client.ts`:
`createApiClient` gains `requestMultipart(path, formData)` (and its method union gains `DELETE`),
so token handling, error parsing, and the single retry stay in one place.

### Localisation

Add English and Chinese keys for: photo label, choose-photo button, remove-photo button, upload
errors (size/type), and the profile-save error.

## Acceptance criteria

### Schema and migrations

- [x] `0003_user_profile.sql` adds `users.email`, `profiles.role`, and
      `profiles.user_avatar_key`; the migration set applies to a fresh local D1 and re-applies as a
      no-op.
- [x] Existing profiles have `role = 'user'`, `user_avatar_key = NULL`; existing users have
      `email = NULL`.
- [x] The check constraint refuses `role` outside `('user','teacher','admin')`.
- [x] `profiles.avatar`, `characterName`, and the buddy tables are unchanged; a profile row
      survives with all its values after the migration.

### Token sync

- [x] A token with `roles: ["admin"]` stores `admin`; `["teacher","user"]` stores `teacher`;
      `["user"]` stores `user`; absent or malformed stores `user`.
- [x] `email` is preferred over `preferred_username`; a blank value stores nothing; a later token
      without either does not clear an existing email.
- [x] Sync happens on `GET /v1/me` and on every mutating `/v1/me*` route, writing only on change.
- [x] `POST /v1/me/profile` creates the row with the principal's role.
- [x] No request body can set `email`, `role`, or `user_avatar_key`; an unknown field is a `422`.

### API

- [x] `GET /v1/me` returns top-level `email`, `profile.role`, and `profile.userAvatarKey`; the
      existing fields are unchanged.
- [x] `POST /v1/me/avatar` rejects anonymously with `401` before reading the body or touching R2;
      rejects a missing profile with `404`; rejects over 2 MiB, a missing file, or a non-JPEG/PNG/
      WebP payload with `422`.
- [x] The stored object key is `avatars/<oid>/<uuid>.<ext>`; the row is updated; the previous
      object is deleted best-effort; a failed row update removes the new object best-effort.
- [x] `DELETE /v1/me/avatar` clears the key and deletes the object; a second call still returns
      `204`.
- [x] `GET /v1/avatars/*` serves the object publicly with its content type and immutable cache
      headers, and answers `404` for an unknown key.
- [x] CORS advertises `DELETE`; the route table distinguishes `405` on `/v1/me/avatar`.
- [x] A missing `AVATARS` binding fails the request with `config_missing` before any write.

### Client

- [x] The top-right chip shows the uploaded photo, or an initials tile when none exists, plus the
      display name. It is not clickable.
- [x] The sidebar mini-profile still opens Settings.
- [x] Settings can choose, preview, upload, and remove a photo; no client-side downscale.
- [x] Saving display name and/or photo returns to `#/home`; a failed save stays on Settings with
      an error.
- [x] The buddy portrait and buddy picker are unchanged everywhere.
- [x] Email and role are not displayed anywhere.
- [x] The 2 MiB limit and JPEG/PNG/WebP restriction are visible as error messages in both locales.

### Documentation

- [x] `docs/PRD.md` §8.3 records `email`, `role`, and `user_avatar_key`; the decision-log row that
      says email and display name are not stored is amended.
- [x] `docs/privacy.md` and `page/public/privacy.html` state that email is now stored.
- [x] `docs/operations.md` records the R2 bucket, custom domain, binding, and the app-role
      prerequisite.
- [x] `docs/develop/login.md` records the `roles` claim mapping and the `email` →
      `preferred_username` fallback.
- [x] `docs/develop/page.md` and `docs/develop/worker.md` record `VITE_AVATAR_BASE_URL`, the R2
      binding, and local avatar serving.
- [x] Mission 2's feature table adds 26; Mission 3 renumbers to 27+ (admin portal 27, vocabulary
      admin 28, artwork 29, review/release 30).

## Tests by tier

| Tier | What it proves |
|---|---|
| Unit | role precedence (`admin > teacher > user`), absent/unknown → `user`; email preference and blank handling; image magic-byte sniffing; key shape and URL composition; name validation reuse. |
| Model | `Profiles` and `Users` declare the new columns, default, and check constraint; generated SQL is the expected shape. |
| Database | migration applies and is a no-op on re-apply; default fills `user`; invalid role is refused; email/role/key round-trip in a fresh scope; sync writes only on change; profile row survives. |
| Host | real Worker via `wrangler dev`: `/v1/me` shape; anonymous avatar upload `401`; upload/remove/read against local R2; `404` unknown key; CORS `DELETE`; missing binding fails fast. |
| Client | Settings photo flow and save-then-home; top-right chip photo/initials; sidebar entry unchanged; no role/email rendering. |

The R2 tier uses the local `wrangler dev` emulator, the same way the existing database and host
tiers use local D1. No fake bucket or repository double is introduced.

## Tasks (ordered)

1. **Schema (RED → GREEN).** Add the Drizzle definitions and generate `0003`; write model and
   database tests first: columns, default, check refusal, migration re-apply, row survival.
2. **Principal.** Extend `Principal` and the verifier with `email` and `role`; unit-test the
   mapping and fallbacks.
3. **Sync.** Extend `ensureUser` and `createProfile`; database tests for write-only-on-change and
   profile creation with a role.
4. **Read surface.** Add `email`, `role`, and `userAvatarKey` to `MeResponse`/`ServerProfile`;
   host-test the `/v1/me` shape.
5. **R2.** Add the binding, env type, `requireAvatars`, and the minimal R2 interface; add
   `POST`/`DELETE /v1/me/avatar` and public `GET /v1/avatars/*`; update the route table and CORS;
   host and external-service tests first.
6. **Client types.** Add `role`/`userAvatarKey`/`email`, the boot mapping, and the avatar URL
   helper; unit-test composition and rejection of unsafe keys.
7. **Top bar.** Add the display-only chip to `AppShell`; client tests for photo/initials and no
   click behaviour.
8. **Settings.** Add photo picker, preview, removal, upload-then-PATCH save, home navigation, and
   both locales; client tests for the happy path and each failure.
9. **Docs.** Update the documents listed above.
10. **Verify.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:dist`; a manual local run
    uploading a photo and reloading to confirm the R2-backed image survives.

## Out of scope

- Role-based authorization, gated routes, or any teacher/admin UI. Mission 3 consumes the stored
  role.
- Showing or editing email; changing a role from the app.
- Replacing the buddy with the user's photo; buddy art and stages stay as they are.
- Cropping, resizing, transcoding, or image moderation; the Worker stores the uploaded bytes.
- Multiple photos, photo history, or an avatar table.
- Admin user management, account deletion, or cross-user profile access.
