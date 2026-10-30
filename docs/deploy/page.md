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

Production URL: <https://words-wizard.pages.dev>. Attach `words.nioh.uk` under **Custom domains**;
TLS is automatic.

No environment variables are needed today. Feature 24 adds the API base URL — set
`VITE_API_BASE_URL=https://wordsapi.nioh.uk` in **Settings → Environment variables → Production**
when that lands.

Do not add a deployment workflow or a `CLOUDFLARE_API_TOKEN` secret: the Git integration owns
deployment, and `src/page/scripts/deployment-config.test.ts` asserts it.

## Deploy

1. Open a pull request against `develop`. CI runs `typecheck`, `worker:typecheck`, `test`,
   `build`, and `check:dist`.
2. Merge the pull request, then promote `develop` → `master`. The merge into `master` is the
   release action.
3. Pages rebuilds automatically. Watch it under **Workers & Pages → words-wizard → Deployments**.
4. Verify the deployed build from the repository:

   ```bash
   cd src
   pnpm check:deploy https://words.nioh.uk
   ```

   It fetches `/`, one hashed asset, and one image, and asserts their status, content type, and
   cache headers.

## Rollback

**Workers & Pages → words-wizard → Deployments** → pick the previous successful deployment →
**Rollback**. The page holds no server-side state, so a rollback needs nothing else.
