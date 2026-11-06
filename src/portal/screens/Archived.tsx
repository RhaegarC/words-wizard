import { useState, type ReactNode } from "react"

import type { AdminPack, AdminTopic } from "../../shared/admin"
import {
  PageHeading,
  Panel,
  SECONDARY_BUTTON,
  formatDate,
} from "./shared"
import type { ScreenProps } from "./types"

/**
 * The Archived view. Words never appear here: they are never archived, only
 * removed from packs. Restoring makes an item visible to children immediately.
 */
export function Archived({
  route,
  snapshot,
  api,
  navigate,
  refresh,
  notify,
  report,
}: ScreenProps) {
  const tab = route.screen === "archived" ? route.tab : "topics"
  const [busyId, setBusyId] = useState<string | null>(null)

  const topics = snapshot.topics.filter((topic) => topic.archivedAt !== null)
  const packs = snapshot.packs.filter((pack) => pack.archivedAt !== null)

  async function restoreTopic(topic: AdminTopic): Promise<void> {
    setBusyId(topic.id)

    try {
      await api.setTopicArchived(topic.id, false, snapshot.contentVersion)
      await refresh()
      notify("Topic restored.")
    } catch (caught) {
      report(caught)
    } finally {
      setBusyId(null)
    }
  }

  async function restorePack(pack: AdminPack): Promise<void> {
    setBusyId(pack.id)

    try {
      await api.setPackArchived(pack.id, false, snapshot.contentVersion)
      await refresh()
      notify("Pack restored.")
    } catch (caught) {
      report(caught)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeading
        title="Archived"
        description="Archived items are hidden from children. Restoring makes them visible again immediately."
      />

      <div className="mb-5 flex gap-2">
        <Tab
          active={tab === "topics"}
          onClick={() => navigate({ screen: "archived", tab: "topics" })}
        >
          Topics ({topics.length})
        </Tab>
        <Tab
          active={tab === "packs"}
          onClick={() => navigate({ screen: "archived", tab: "packs" })}
        >
          Packs ({packs.length})
        </Tab>
      </div>

      {tab === "topics" ? (
        <RowList
          empty="No topics are archived."
          rows={topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            titleZh: topic.titleZh,
            detail: `Archived ${formatDate(topic.archivedAt)}`,
            busy: busyId === topic.id,
            onRestore: () => void restoreTopic(topic),
          }))}
        />
      ) : (
        <RowList
          empty="No packs are archived."
          rows={packs.map((pack) => ({
            id: pack.id,
            title: pack.title,
            titleZh: pack.titleZh,
            detail: `${
              snapshot.topics.find((topic) => topic.id === pack.topicId)
                ?.title ?? pack.topicId
            } · archived ${formatDate(pack.archivedAt)}`,
            busy: busyId === pack.id,
            onRestore: () => void restorePack(pack),
          }))}
        />
      )}
    </>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
        active
          ? "bg-[var(--admin-purple-pale)] text-[var(--admin-purple)]"
          : "text-[var(--admin-muted)] hover:bg-white"
      }`}
    >
      {children}
    </button>
  )
}

interface Row {
  id: string
  title: string
  titleZh: string
  detail: string
  busy: boolean
  onRestore: () => void
}

function RowList({ rows, empty }: { rows: readonly Row[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-[var(--admin-muted)]">{empty}</p>
      </Panel>
    )
  }

  return (
    <ul className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3 last:border-0"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--admin-ink)]">
              {row.title}
            </p>
            <p className="text-[11px] text-[var(--admin-muted)]">
              {row.titleZh}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--admin-muted)]">
              {row.detail}
            </p>
          </div>
          <button
            type="button"
            className={`${SECONDARY_BUTTON} px-3 py-1.5 text-xs`}
            disabled={row.busy}
            onClick={row.onRestore}
          >
            {row.busy ? "Restoring…" : "Restore"}
          </button>
        </li>
      ))}
    </ul>
  )
}
