import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"

const srcRoot = import.meta.dirname

export default defineConfig({
  // The package, all app source, and the build output live in src/.
  root: srcRoot,
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
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": srcRoot,
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
  test: {
    root: srcRoot,
    environment: "node",
    include: ["**/*.test.ts"],
    // Local-calendar day math must be proven off UTC and across both DST
    // transitions; a UTC run would not exercise either.
    env: { TZ: "America/New_York" },
  },
})
