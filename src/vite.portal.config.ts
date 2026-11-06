import { join } from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const srcRoot = import.meta.dirname
const portalRoot = join(srcRoot, "portal")

/**
 * The admin portal is a second application in the same package. It has no
 * service worker, no locale bundle, and its own output directory, so the
 * child app's build can never contain it.
 */
export default defineConfig({
  root: portalRoot,
  // Both apps read the one .env in the package root.
  envDir: srcRoot,
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist-portal",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": join(srcRoot, "shared"),
    },
  },
  server: {
    host: true,
    port: 8444,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 8444,
    strictPort: true,
  },
})
