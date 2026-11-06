# Feature 31 — Word Images

> Priority: Must · Mission 3 · **Status: Implemented**
> Depends on: 30 (word library). Blocks: 32.
> Source of truth: [Mission 3 sprint](00-mission-3-sprint.md) and the
> [portal UI brief](../../../Portal.md).

## Summary

Let a teacher upload, replace, and remove the picture a word shows a child, without an engineer and
without a separate artwork step.

Word images use a **dedicated R2 bucket**, not the avatar bucket, and follow the avatar pipeline
exactly: magic bytes decide the stored type, a key shape controls what can be read back, and the
read path is immutable and cached for a year. The word's `image` field is a URL; the editor never
lets a teacher type one, so a typo cannot become a broken image.

Artwork **review and approval** are not part of this feature; feature 32 covers them.

## User story

As a **teacher**, I open a word, upload a picture of a box, and see it previewed. If the picture is
wrong, I replace it; if the word should fall back to its emoji, I remove it. Children see the new
picture on their next refresh.

## Design

### Storage

- A new R2 bucket, **`words-wizard-images`**, bound as `WORD_IMAGES` in the Worker configuration.
  The avatar bucket is untouched.
- Key shape: `word-images/<wordId>/<uuid>.<ext>` with `ext` in `png`, `jpg`, `webp`. Only keys this
  route could have written are readable.
- Accepted types are decided by magic bytes, reusing the avatar detector: PNG, JPEG, and WebP.
  The declared content type and filename are never trusted.
- Maximum size **2 MiB**, enforced before the multipart body is parsed and again on the file.
- Objects are stored with `public, max-age=31536000, immutable`; the UUID key makes each upload a
  new immutable object, so a replace never fights a cache.

### Routes

| Method | Path | Effect |
|---|---|---|
| POST | `/v1/admin/words/:id/image` | multipart upload; store object, set `words.image`, delete the previous object, bump version |
| DELETE | `/v1/admin/words/:id/image` | clear `words.image`, delete the object, bump version |
| GET | `/v1/images/*` | public read; unauthorised callers allowed, like `/v1/avatars/*` |

- Upload requires a staff token; the word must exist and not be archived.
- The stored URL is derived from the **request origin**:
  `<origin>/v1/images/<key>`. Local development stores `localhost:8787`; production stores the
  public API host. No extra configuration can point it at the wrong place.
- The public read route validates the key shape before touching R2, returns not-found for anything
  else, and serves the stored content type with the immutable cache header.
- The previous object is deleted best-effort after the row update succeeds; a failed delete does
  not fail the request.
- Creating or editing a word never accepts an `image` value.

### Portal

The word editor gains an image card with four states: empty drop zone (“Upload an image — PNG,
JPEG, or WebP, up to 2 MB”), preview with **Replace image** and **Remove image**, uploading, and
error (“That file isn't a supported image…”). The emoji remains a separate text field on the word
record (feature 30) and is the fallback when no image exists.

### Child app

- `resolveArtwork` already renders an absolute `image` URL and falls back to the emoji.
- The service worker gains a CacheFirst rule for `/v1/images/` so word pictures are available
  offline, matching how avatars are cached.
- No other child-facing change.

## Acceptance criteria

- [x] A PNG, JPEG, or WebP up to 2 MiB uploads, is stored under `word-images/<wordId>/<uuid>.<ext>`,
      and `words.image` points at it.
- [x] The image is served from `/v1/images/...` with its stored content type and immutable caching.
- [x] A fake image (wrong magic bytes), an unsupported type, and an oversized file are rejected
      without writing anything.
- [x] Replacing an image writes a new key, updates `words.image`, and removes the old object; no
      stale object is left behind when deletion succeeds.
- [x] Removing an image clears `words.image` and the child app falls back to the emoji.
- [x] The word create/edit paths reject an `image` field.
- [x] A non-staff caller cannot upload or remove; the public read route needs no token.
- [x] Each accepted image change bumps the content version; a rejection does not.
- [x] The child app caches word images for offline use.
- [x] The avatar bucket and its keys are never touched.

## Implementation notes

- `src/worker/wordImage.ts` holds the key shape, URL helpers, and size cap;
  `src/worker/avatar.ts`'s `detectImageType` and extension type are reused, so both buckets accept
  the same three formats by magic bytes.
- The object is written before the row update and deleted again if the update fails; the previous
  object is removed only after the row update succeeds.
- `wrangler dev` rewrites the request origin to the first configured custom-domain route by
  default. The host-tier harness boots it with `--infer-origin-from-routes false` so a locally
  stored image URL is fetchable at `127.0.0.1:<port>`; production keeps deriving the public host
  from the request origin.
- The host tier exercises the real local R2 binding (`--persist-to`), so upload, replace, remove,
  and the old-object 404 are assertions about the object store, not a double.

## Test plan

- **Worker unit** — `src/worker/test/wordImage.test.ts`: key shape validation, URL derivation from
  the request origin, and the size/cache constants. Magic-byte detection is already covered by
  `avatar.test.ts` because the same detector is reused.
- **Portal unit** — `src/portal/test/api.test.ts`: the multipart upload's verb, path, `If-Match`,
  and the absence of a hand-set `Content-Type`; the DELETE call.
- **Doc assertion** — `src/page/test/pwa/runtimeCaching.test.ts`: the Vite config keeps a
  CacheFirst rule for `/v1/images/`.
- **Host tier** — `src/worker/test/admin.test.ts`: upload, fetch back, replace (old key gone),
  remove (emoji remains), fake/unsupported/oversize rejection with nothing written, unknown key
  and traversal rejected by the public route, 401/403, and version bumps.
- **Database tier** — not extended: the image write is a single-row update already covered by the
  host tier; the store assertions that matter are the object store's, which the host tier exercises
  against the local R2 binding.
- **Manual** — upload, replace, and remove from the portal; confirm the child app shows the image
  and falls back after removal.

## Documentation impact

`docs/develop/worker.md` (image routes, key shape, caps), `docs/operations.md` (bucket creation and
binding), `docs/develop/portal.md` (image states), README (bucket list).

## Out of scope

Artwork review, approval, and tracking (feature 32); server-side resizing or format conversion;
multiple images per word; image licensing or attribution fields.
