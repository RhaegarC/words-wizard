import { readFileSync } from "node:fs"
import { join } from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const srcRoot = import.meta.dirname
const pageRoot = join(srcRoot, "page")

/**
 * Vite copies `public/` verbatim and refuses to import it from JavaScript, so
 * the locale dictionaries live under `i18n/locales/` and are imported there.
 * This keeps the `/locales/*.json` contract — the service worker precache and
 * the one-hour cache rule in `public/_headers` — by serving the same files in
 * development and emitting them into the build.
 */
function localeAssets(root: string): Plugin {
  const directory = join(root, "i18n", "locales")
  const locales = ["en", "zh"] as const

  return {
    name: "words-wizard:locale-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = /^\/locales\/(en|zh)\.json(?:\?.*)?$/.exec(request.url ?? "")

        if (match === null) {
          next()
          return
        }

        response.setHeader("Content-Type", "application/json")
        response.end(readFileSync(join(directory, `${match[1]}.json`)))
      })
    },
    generateBundle() {
      for (const locale of locales) {
        this.emitFile({
          type: "asset",
          fileName: `locales/${locale}.json`,
          source: readFileSync(join(directory, `${locale}.json`), "utf8"),
        })
      }
    },
  }
}

export default defineConfig({
  // The SPA lives in page/; the package, shared code, and build output stay in src/.
  root: pageRoot,
  // Read .env from the package root (src/), not Vite's default of page/.
  envDir: srcRoot,
  // Relative asset URLs so the build also works from a sub-path.
  base: "./",
  plugins: [
    localeAssets(pageRoot),
    react(),
    tailwindcss(),
    VitePWA({
      // The public manifest is hand-authored; the plugin only writes the worker.
      manifest: false,
      registerType: "prompt",
      // UpdateProvider registers through virtual:pwa-register/react so the
      // update notice can see a waiting worker instead of swapping silently.
      injectRegister: false,
      workbox: {
        // A waiting worker must never activate itself (PRD §8.7).
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        // Shell-only precache. Artwork is fetched at runtime, so a new avatar
        // or word image does not force a worker update.
        globPatterns: [
          "**/*.{js,css,html,json,webmanifest,svg,woff2}",
          "icons/*.png",
        ],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Bundled avatar portraits.
            urlPattern: /\/art\//,
            handler: "CacheFirst",
            options: {
              cacheName: "art",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // Word pictures served by the Worker (feature 31). Each upload is a
            // new immutable URL, so cache-first is safe.
            urlPattern: /\/v1\/images\//,
            handler: "CacheFirst",
            options: {
              cacheName: "word-images",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // Word images served from R2 (authored rows may still point here).
            urlPattern: /^https:\/\/[^/]+\.r2\.(?:dev|cloudflarestorage\.com)\//i,
            handler: "CacheFirst",
            options: {
              cacheName: "word-images",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  publicDir: "public",
  build: {
    // Pages keeps its configured output directory at src/dist.
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": join(srcRoot, "shared"),
      "@": pageRoot,
    },
  },
  server: {
    host: true,
    port: 8443,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 8443,
    strictPort: true,
  },
})
