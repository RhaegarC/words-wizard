import type { ReactNode } from "react"

import type { ContentIssue } from "../../shared/content/types"
import { AdminRequestError } from "../api"

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--admin-ink)]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--admin-muted)]">{description}</p>
      </div>
      {action}
    </header>
  )
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[15px] border border-[var(--admin-line)] bg-white p-5">
      {children}
    </section>
  )
}

export function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-black tracking-wide text-[var(--admin-ink)] uppercase">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {hint === undefined ? null : (
        <span className="mt-1 block text-[11px] text-[var(--admin-muted)]">
          {hint}
        </span>
      )}
    </label>
  )
}

export const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--admin-line)] bg-white px-3 py-2.5 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-purple)]"

export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-xl bg-[var(--admin-purple)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--admin-purple-dark)] disabled:cursor-not-allowed disabled:opacity-50"

export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center rounded-xl border border-[var(--admin-line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--admin-ink)] transition hover:bg-[var(--admin-canvas)]"

export const DANGER_BUTTON =
  "inline-flex items-center justify-center rounded-xl border border-[var(--admin-coral)]/30 bg-[var(--admin-coral-pale)] px-4 py-2.5 text-sm font-bold text-[var(--admin-coral)] disabled:opacity-50"

/** The validator findings a 422 carries, as human lines. */
export function issueMessages(caught: unknown): string[] {
  if (!(caught instanceof AdminRequestError)) return []

  return (caught.issues ?? []).map((issue) => {
    if (typeof issue === "string") return issue

    if (typeof issue === "object" && issue !== null) {
      const finding = issue as { message?: unknown; code?: unknown }
      if (typeof finding.message === "string") return finding.message
      if (typeof finding.code === "string") return finding.code
    }

    return "The change does not satisfy the content rules."
  })
}

export function IssueList({ issues }: { issues: readonly string[] }) {
  if (issues.length === 0) return null

  return (
    <ul className="mb-5 list-disc space-y-1 rounded-[15px] border border-[var(--admin-coral)]/20 bg-[var(--admin-coral-pale)] px-6 py-4 text-sm font-semibold text-[var(--admin-coral)]">
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
    </ul>
  )
}

/** Editorial warnings never block a save; they are shown and dismissed. */
export function WarningList({
  issues,
}: {
  issues: readonly ContentIssue[]
}) {
  const unique = [...new Set(issues.map((issue) => issue.message))]
  if (unique.length === 0) return null

  return (
    <ul className="mb-5 list-disc space-y-1 rounded-[15px] border border-[var(--admin-amber)]/30 bg-[var(--admin-amber-pale)] px-6 py-4 text-sm font-semibold text-[var(--admin-amber)]">
      {unique.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}

export function NotFoundPanel({ message }: { message: string }) {
  return (
    <Panel>
      <p className="text-sm font-bold">{message}</p>
      <p className="mt-1 text-xs text-[var(--admin-muted)]">
        It may have been removed or refreshed. Return to the list and try again.
      </p>
    </Panel>
  )
}

export function formatDate(value: number | null): string {
  if (value === null) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}
