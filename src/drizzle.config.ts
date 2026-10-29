import { defineConfig } from "drizzle-kit"

/**
 * D1 is SQLite. Migrations generated here are applied with
 * `wrangler d1 migrations apply`; D1 rejects explicit BEGIN/COMMIT, so the
 * generated files stay as plain statements.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./worker/db/schema.ts",
  out: "./worker/drizzle",
  strict: true,
  verbose: true,
})
