import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const projectRoot = import.meta.dirname
const srcRoot = path.resolve(projectRoot, "src")

export default defineConfig({
  // All application source lives in src/; the repository root holds only toolchain files.
  root: srcRoot,
  // Relative asset URLs so the build also works from a sub-path.
  base: "./",
  plugins: [react(), tailwindcss()],
  publicDir: "public",
  build: {
    outDir: "../dist",
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
    root: projectRoot,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
