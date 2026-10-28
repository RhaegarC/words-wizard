import { join } from "node:path"

import { defineConfig } from "vitest/config"

const srcRoot = import.meta.dirname

export default defineConfig({
  root: srcRoot,
  resolve: {
    alias: {
      "@shared": join(srcRoot, "shared"),
      "@": join(srcRoot, "page"),
    },
  },
  test: {
    environment: "node",
    include: [
      "page/**/*.test.ts",
      "shared/**/*.test.ts",
      "worker/**/*.test.ts",
    ],
    // Local-calendar day math must be proven off UTC and across both DST
    // transitions; a UTC run would not exercise either.
    env: { TZ: "America/New_York" },
  },
})
