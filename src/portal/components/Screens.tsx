import type { ReactNode } from "react"

import type { AdminSnapshot } from "../../shared/admin"
import type { PortalScreen } from "../router"

/**
 * The feature-28 shell is read-only: it proves the snapshot loads and shows
 * what is in it. Topics and packs editing, the word library, and membership
 * arrive in features 29–31, which replace these summaries.
 */
export function ScreenContent({
  screen,
  snapshot,
  error,
}: {
  screen: PortalScreen
  snapshot: AdminSnapshot | null
  error: string | null
}) {
  if (error !== null) {
    return (
      <div className="rounded-[15px] border border-[var(--admin-coral)]/20 bg-[var(--admin-coral-pale)] px-5 py-4 text-sm font-semibold text-[var(--admin-coral)]">
        {error}
      </div>
    )
  }

  if (snapshot === null) {
    return (
      <div className="rounded-[15px] border border-[var(--admin-line)] bg-white p-10 text-center">
        <p className="text-sm font-bold">Loading the content snapshot…</p>
      </div>
    )
  }

  if (screen === "words") return <WordsSummary snapshot={snapshot} />
  if (screen === "archived") return <ArchivedSummary snapshot={snapshot} />

  return <TopicsSummary snapshot={snapshot} />
}

function PageHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--admin-ink)]">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-[var(--admin-muted)]">{description}</p>
    </header>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[15px] border border-[var(--admin-line)] bg-white p-5">
      <p className="text-[10px] font-black tracking-wider text-[var(--admin-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{value}</p>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="mt-5 rounded-[15px] border border-[var(--admin-line)] bg-white p-5">
      {children}
    </section>
  )
}

function TopicsSummary({ snapshot }: { snapshot: AdminSnapshot }) {
  const liveTopics = snapshot.topics.filter((topic) => topic.archivedAt === null)
  const livePacks = snapshot.packs.filter((pack) => pack.archivedAt === null)

  return (
    <>
      <PageHeading
        title="Topics"
        description="Manage the worlds learners choose from."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live topics" value={liveTopics.length} />
        <StatCard label="Live packs" value={livePacks.length} />
        <StatCard label="Words" value={snapshot.words.length} />
        <StatCard
          label="Archived"
          value={
            snapshot.topics.filter((topic) => topic.archivedAt !== null).length +
            snapshot.packs.filter((pack) => pack.archivedAt !== null).length
          }
        />
      </div>
      <Panel>
        <h2 className="text-sm font-extrabold">Content version</h2>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          The snapshot is version{" "}
          <span className="font-mono font-bold">{snapshot.contentVersion}</span>{" "}
          ({snapshot.dataset} dataset). Topic and pack editing arrives with the
          next feature.
        </p>
      </Panel>
    </>
  )
}

function WordsSummary({ snapshot }: { snapshot: AdminSnapshot }) {
  const inPack = new Set(
    snapshot.memberships.flatMap((membership) => membership.wordIds),
  )

  return (
    <>
      <PageHeading
        title="Words"
        description="Shared master vocabulary used across every pack."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Words" value={snapshot.words.length} />
        <StatCard
          label="Not in any pack"
          value={snapshot.words.filter((word) => !inPack.has(word.id)).length}
        />
        <StatCard
          label="Archived"
          value={
            snapshot.words.filter((word) => word.archivedAt !== null).length
          }
        />
      </div>
      <Panel>
        <h2 className="text-sm font-extrabold">Word library</h2>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          Words are shared across packs and are never deleted. Creating and
          editing words arrives with feature 30.
        </p>
      </Panel>
    </>
  )
}

function ArchivedSummary({ snapshot }: { snapshot: AdminSnapshot }) {
  const topics = snapshot.topics.filter((topic) => topic.archivedAt !== null)
  const packs = snapshot.packs.filter((pack) => pack.archivedAt !== null)

  return (
    <>
      <PageHeading
        title="Archived"
        description="Archived items are hidden from children. Restoring makes them visible again immediately."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ArchiveList
          title="Topics"
          empty="No topics are archived."
          items={topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            titleZh: topic.titleZh,
            archivedAt: topic.archivedAt,
          }))}
        />
        <ArchiveList
          title="Packs"
          empty="No packs are archived."
          items={packs.map((pack) => ({
            id: pack.id,
            title: pack.title,
            titleZh: pack.titleZh,
            archivedAt: pack.archivedAt,
          }))}
        />
      </div>
      <Panel>
        <h2 className="text-sm font-extrabold">Restore</h2>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          Restoring arrives with feature 29.
        </p>
      </Panel>
    </>
  )
}

function ArchiveList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{
    id: string
    title: string
    titleZh: string
    archivedAt: number | null
  }>
}) {
  return (
    <section className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">
      <h2 className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-3 text-[10px] font-black tracking-wider text-[var(--admin-muted)] uppercase">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="p-6 text-xs text-[var(--admin-muted)]">{empty}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="border-b border-[var(--admin-line)] px-4 py-3 last:border-0"
          >
            <b className="block text-sm">{item.title}</b>
            <span className="text-xs text-[var(--admin-muted)]">
              {item.titleZh}
            </span>
            <p className="mt-1 text-[10px] text-zinc-400">
              Archived {formatDate(item.archivedAt)}
            </p>
          </div>
        ))
      )}
    </section>
  )
}

function formatDate(value: number | null): string {
  if (value === null) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}
