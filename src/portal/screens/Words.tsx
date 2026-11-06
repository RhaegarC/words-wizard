import { PageHeading, Panel } from "./shared"
import type { ScreenProps } from "./types"

/**
 * The word library summary. Word create/edit and pack membership arrive in
 * feature 30, which replaces this panel with the real library.
 */
export function Words({ snapshot }: ScreenProps) {
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
          value={snapshot.words.filter((word) => word.archivedAt !== null).length}
        />
      </div>
      <div className="mt-5">
        <Panel>
          <h2 className="text-sm font-extrabold">Word library</h2>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            Words are shared across packs and are never deleted. Creating and
            editing words arrives with feature 30.
          </p>
        </Panel>
      </div>
    </>
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
