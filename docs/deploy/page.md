# Deploy the page

The page is a static Vite build: source in `src/page`, output in `src/dist`. Cloudflare Pages
builds it from Git and serves it — no GitHub deployment workflow and no Cloudflare credential are
involved.

## One-time setup

Connect the Pages project to `RhaegarC/words-wizard` with these settings:

| Setting | Value |
|---|---|
| Project name | `words-wizard` |
| Production branch | `master` |
| Root directory | `src` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Build environment | Node 22, pnpm 10 |
| Preview deployments | Off |

Production URL: <https://words.nioh.uk>. Attach the custom domain under **Custom domains**; TLS
is automatic.

Set these in **Settings → Environment variables → Production** for the build:

- `VITE_ENTRA_CLIENT_ID` — the SPA application (client) id
- `VITE_ENTRA_TENANT_ID` — the Entra tenant id
- `VITE_ENTRA_SCOPE` — `api://<client-id>/access_as_user`
- `VITE_API_BASE_URL` — `https://wordsapi.nioh.uk`

They are public configuration; there is no client secret. The matching Worker vars and the D1
database are in [worker.md](worker.md); the full topology is in [operations.md](../operations.md).

Do not add a deployment workflow or a `CLOUDFLARE_API_TOKEN` secret: the Git integration owns
deployment, and `src/page/scripts/deployment-config.test.ts` asserts it.

## Deploy

1. Open a pull request against `develop`. CI runs `typecheck`, `test`, `build`, and
   `check:dist`.
2. Merge the pull request, then promote `develop` → `master`. The merge into `master` is the
   release action.
3. Pages rebuilds automatically. Watch it under **Workers & Pages → words-wizard → Deployments**.
4. Verify the deployed build and its API from the repository:

   ```bash
   cd src
   EXPECTED_CONTENT_VERSION=0.3.0 pnpm check:deploy
   ```

   It checks the Pages document and a hashed asset, the Worker `/health`, the content version
   and ETag, the allowed CORS origin, and that an unlisted origin gets no CORS header.

## Rollback

**Workers & Pages → words-wizard → Deployments** → pick the previous successful deployment →
**Rollback**. The page stores no learner data, so D1 is unaffected by an app rollback.
