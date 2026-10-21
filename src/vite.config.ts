import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const srcRoot = import.meta.dirname

export default defineConfig({
  // The package and all app source live in src/; only the build output leaves it.
  root: srcRoot,
  // Relative asset URLs so the build also works from a sub-path.
  base: "./",
  plugins: [react(), tailwindcss()],
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
  },
})
