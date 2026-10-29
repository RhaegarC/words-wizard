import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { TEST_ENV } from "./tokens"

/**
 * Host tier: the Worker is booted in `wrangler dev` against unreachable
 * network endpoints. It proves the real runtime, config middleware, routing,
 * and CORS wiring start and answer — not that Entra or D1 accept anything.
 * No database is opened.
 */

const srcRoot = fileURLToPath(new URL("../..", import.meta.url))
const wranglerBin = join(
  srcRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
)
const workerConfig = join(srcRoot, "worker", "wrangler.jsonc")
const missingConfig = join(
  srcRoot,
  "worker",
  "test",
  "fixtures",
  "wrangler-missing-config.jsonc",
)

interface RunningWorker {
  readonly baseUrl: string
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

async function startWorker(
  configPath: string,
  vars: Record<string, string> = {},
): Promise<RunningWorker> {
  const persistDir = await mkdtemp(join(tmpdir(), "words-wizard-worker-"))
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
    env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
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
      return { baseUrl, stop }
    } catch {
      await delay(250)
    }
  }

  await stop()
  throw new Error(`wrangler dev never became reachable\n${output.slice(-4000)}`)
}

describe("host tier: wrangler dev", () => {
  let worker: RunningWorker

  beforeAll(async () => {
    worker = await startWorker(workerConfig, { ...TEST_ENV })
  }, 120_000)

  afterAll(async () => {
    await worker?.stop()
  })

  it("serves GET /health", async () => {
    const response = await fetch(`${worker.baseUrl}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("returns the 404 envelope for an unknown route", async () => {
    const response = await fetch(`${worker.baseUrl}/v1/nope`)

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: { code: "not_found" },
    })
  })

  it("answers an allowed preflight with 204 and CORS headers", async () => {
    const response = await fetch(`${worker.baseUrl}/health`, {
      method: "OPTIONS",
      headers: { Origin: "https://words.nioh.uk" },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://words.nioh.uk",
    )
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "GET",
    )
  })

  it("sends no allow-origin for an unlisted origin", async () => {
    const response = await fetch(`${worker.baseUrl}/health`, {
      headers: { Origin: "https://evil.test" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("host tier: fail-fast configuration", () => {
  it("fails every request with 500 config_missing when a required var is absent", async () => {
    const worker = await startWorker(missingConfig)

    try {
      const response = await fetch(`${worker.baseUrl}/health`)
      const body = (await response.json()) as {
        error: Record<string, string>
      }

      expect(response.status).toBe(500)
      expect(body.error.code).toBe("config_missing")
      expect(body.error.message).toContain("EXPECTED_TENANT")
      expect(JSON.stringify(body)).not.toContain("stack")
    } finally {
      await worker.stop()
    }
  }, 120_000)
})
