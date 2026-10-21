import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import type {
  ContentBundle,
  ContentIssue,
} from "../domain/content/types"
import { hasErrors, validateContent } from "../domain/content/validate"

const srcRoot = fileURLToPath(new URL("..", import.meta.url))
const contentRoot = join(srcRoot, "content")

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(join(contentRoot, relativePath), "utf8"),
  ) as T
}

const bundle = {
  meta: readJson<ContentBundle["meta"]>("content-meta.json"),
  topics: readJson<ContentBundle["topics"]>("topics.json"),
  packs: readJson<ContentBundle["packs"]>("packs.json"),
  words: readJson<ContentBundle["words"]>("words.json"),
  avatars: readJson<ContentBundle["avatars"]>("avatars.json"),
  artwork: readJson<ContentBundle["artwork"]>("art/manifest.json"),
}

const artExists = (file: string): boolean =>
  existsSync(join(srcRoot, "public", file)) ||
  existsSync(join(contentRoot, "art", file.replace(/^art\//, "")))

const issues = validateContent(bundle, {
  forbiddenTerms: readJson<readonly string[]>("forbidden-terms.json"),
  artExists,
})

const errors = issues.filter((issue) => issue.severity === "error")
const warnings = issues.filter((issue) => issue.severity === "warning")

console.log(
  `Content ${bundle.meta.dataset} v${bundle.meta.contentVersion} (schema ${bundle.meta.schemaVersion})`,
)

if (errors.length > 0) {
  console.log(`\n${errors.length} error(s):`)

  for (const issue of errors) {
    console.log(`  ✗ ${format(issue)}`)
  }
}

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`)

  for (const line of summariseWarnings(warnings)) {
    console.log(`  ! ${line}`)
  }
}

if (hasErrors(issues)) {
  console.error("\nContent validation failed.")
  process.exitCode = 1
} else {
  console.log("\nContent is valid for this dataset.")
}

function format(issue: ContentIssue): string {
  const id = issue.id ? ` ${issue.id}` : ""

  return `${issue.file} [${issue.code}]${id} — ${issue.message}`
}

/** Warnings are expected in `dev`, so collapse them to keep the report
 * readable instead of printing one line per unauthored slot. */
function summariseWarnings(entries: readonly ContentIssue[]): string[] {
  const unresolvedByPack = new Map<string, number>()
  const grouped = new Map<string, ContentIssue[]>()

  for (const issue of entries) {
    if (issue.code === "pack-word-ref") {
      const packId = /Pack "([^"]+)"/.exec(issue.message)?.[1] ?? "unknown"
      unresolvedByPack.set(packId, (unresolvedByPack.get(packId) ?? 0) + 1)
      continue
    }

    const key = `${issue.file} [${issue.code}]`
    const group = grouped.get(key)

    if (group) {
      group.push(issue)
    } else {
      grouped.set(key, [issue])
    }
  }

  const lines: string[] = []

  if (unresolvedByPack.size > 0) {
    const total = [...unresolvedByPack.values()].reduce(
      (sum, count) => sum + count,
      0,
    )
    const packs = [...unresolvedByPack.entries()]
      .map(([packId, count]) => `${packId} (${count})`)
      .join(", ")

    lines.push(
      `packs.json [pack-word-ref] ${total} unresolved slots in ${unresolvedByPack.size} pack(s): ${packs}`,
    )
  }

  for (const [key, group] of grouped) {
    const ids = group.map((issue) => issue.id || "-")
    const shown = ids.slice(0, 5).join(", ")
    const suffix = ids.length > 5 ? `, … ${ids.length - 5} more` : ""

    lines.push(`${key} × ${group.length}: ${shown}${suffix}`)
  }

  return lines
}
