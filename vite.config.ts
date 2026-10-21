import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const root = import.meta.dirname

export default defineConfig({
  // Relative asset URLs so the build also works from a sub-path.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
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
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
