import { join } from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const srcRoot = import.meta.dirname
const pageRoot = join(srcRoot, "page")

export default defineConfig({
  // The SPA lives in page/; the package, shared code, and build output stay in src/.
  root: pageRoot,
  // Relative asset URLs so the build also works from a sub-path.
  base: "./",
  plugins: [
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
        globPatterns: [
          "**/*.{js,css,html,json,webmanifest,svg,png,jpg,jpeg,webp,woff2}",
        ],
        navigateFallback: "index.html",
        // Every illustration plus the shell; the artwork target is 10–15 MB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
