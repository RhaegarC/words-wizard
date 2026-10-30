import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The host-tier harness: boot the real Worker in `wrangler dev` over a local
 * D1 persistence directory, migrated by the committed migration set.
 *
 * Tests own their persistence directory, so every file in this tier is
 * row-scoped and one file's fixtures never reach another's.
 */

export const srcRoot = fileURLToPath(new URL("../..", import.meta.url))
export const wranglerBin = join(
  srcRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
)
export const workerConfig = join(srcRoot, "worker", "wrangler.jsonc")

const WRANGLER_ENV = () => ({
  ...process.env,
  CI: "true",
  WRANGLER_SEND_METRICS: "false",
})

export interface RunningWorker {
  readonly baseUrl: string
  /** Row-scoped SQL against the same local database the Worker reads. */
  query<T>(sql: string): T[]
  stop(): Promise<void>
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    })
    return
  }

  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {
    child.kill("SIGTERM")
  }
}

function wranglerD1(
  persistDir: string,
  configPath: string,
  args: readonly string[],
): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    [
      wranglerBin,
      "d1",
      ...args,
      "--local",
      "--persist-to",
      persistDir,
      "--config",
      configPath,
    ],
    { cwd: srcRoot, env: WRANGLER_ENV(), encoding: "utf8" },
  )
}

/**
 * Apply the migration set to the same local persistence directory the Worker
 * will read. Migrations, never a schema built from the model: a broken
 * migration must fail here, and an already-applied set must be a no-op.
 */
export function applyMigrations(persistDir: string, configPath: string): void {
  const result = wranglerD1(persistDir, configPath, [
    "migrations",
    "apply",
    "DB",
  ])

  if (result.status !== 0) {
    throw new Error(
      `d1 migrations apply failed with ${result.status}\n${result.stdout}\n${result.stderr}`,
    )
  }
}

export function d1Query<T>(
  persistDir: string,
  configPath: string,
  sql: string,
): T[] {
  const result = wranglerD1(persistDir, configPath, [
    "execute",
    "DB",
    "--command",
    sql,
    "--json",
  ])

  if (result.status !== 0) {
    throw new Error(`d1 execute failed\n${result.stdout}\n${result.stderr}`)
  }

  const stdout =
    typeof result.stdout === "string"
      ? result.stdout
      : (result.stdout?.toString() ?? "")
  const json = stdout.slice(stdout.indexOf("["))
  const parsed = JSON.parse(json) as Array<{ results: T[] }>

  return parsed[0]?.results ?? []
}

export function d1Execute(
  persistDir: string,
  configPath: string,
  sql: string,
): void {
  const file = join(
    persistDir,
    `seed-${Math.random().toString(36).slice(2)}.sql`,
  )
  writeFileSync(file, sql)

  const result = wranglerD1(persistDir, configPath, [
    "execute",
    "DB",
    "--file",
    file,
  ])

  if (result.status !== 0) {
    throw new Error(
      `d1 execute failed with ${result.status}\n${result.stdout}\n${result.stderr}`,
    )
  }
}

export interface StartOptions {
  readonly migrate?: boolean
  readonly seed?: string
}

export async function startWorker(
  configPath: string,
  vars: Record<string, string> = {},
  options: StartOptions = {},
): Promise<RunningWorker> {
  const persistDir = await mkdtemp(join(tmpdir(), "words-wizard-worker-"))

  if (options.migrate === true) {
    applyMigrations(persistDir, configPath)
  }

  if (options.seed !== undefined) {
    d1Execute(persistDir, configPath, options.seed)
  }

  const port = 21000 + Math.floor(Math.random() * 20000)
  const baseUrl = `http://127.0.0.1:${port}`
  const args = [
    wranglerBin,
    "dev",
    "--config",
    configPath,
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--persist-to",
    persistDir,
  ]

  for (const [name, value] of Object.entries(vars)) {
    args.push("--var", `${name}:${value}`)
  }

  const child = spawn(process.execPath, args, {
    cwd: srcRoot,
    detached: process.platform !== "win32",
    env: WRANGLER_ENV(),
    stdio: ["ignore", "pipe", "pipe"],
  })

  let output = ""
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString()
  })
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString()
  })

  const stop = async () => {
    killTree(child)
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve()
        return
      }

      const timer = setTimeout(() => {
        child.kill("SIGKILL")
        resolve()
      }, 5_000)

      child.once("exit", () => {
        clearTimeout(timer)
        resolve()
      })
    })
    await rm(persistDir, { recursive: true, force: true })
  }

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      await stop()
      throw new Error(
        `wrangler dev exited with ${child.exitCode}\n${output.slice(-4000)}`,
      )
    }

    try {
      await fetch(`${baseUrl}/health`)
      return {
        baseUrl,
        query: <T>(sql: string) => d1Query<T>(persistDir, configPath, sql),
        stop,
      }
    } catch {
      await delay(250)
    }
  }

  await stop()
  throw new Error(`wrangler dev never became reachable\n${output.slice(-4000)}`)
}
