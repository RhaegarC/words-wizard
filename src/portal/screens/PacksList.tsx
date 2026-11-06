import { useState } from "react"

import type { AdminPack } from "../../shared/admin"
import { moveId } from "../order"
import {
  DANGER_BUTTON,
  NotFoundPanel,
  PageHeading,
  PRIMARY_BUTTON,
  Panel,
  SECONDARY_BUTTON,
} from "./shared"
import type { ScreenProps } from "./types"

/**
 * Packs inside one topic. Moving a pack up or down saves immediately, so the
 * child app sees the curated order without a separate publish step.
 */
export function PacksList({
  route,
  snapshot,
  api,
  navigate,
  refresh,
  report,
}: ScreenProps) {
  const topicId = route.screen === "packs" ? route.topicId : null
  const topic =
    topicId === null
      ? undefined
      : snapshot.topics.find((candidate) => candidate.id === topicId)

  const [busyId, setBusyId] = useState<string | null>(null)

  if (topicId !== null && topic === undefined) {
    return <NotFoundPanel message="That topic does not exist." />
  }

  if (topic !== undefined && topic.archivedAt !== null) {
    return (
      <Panel>
        <p className="text-sm font-bold">This topic is archived.</p>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          Restore it from the Archived view to manage its packs.
        </p>
        <button
          type="button"
          className={`${SECONDARY_BUTTON} mt-4`}
          onClick={() => navigate({ screen: "archived", tab: "topics" })}
        >
          Open Archived
        </button>
      </Panel>
    )
  }

  if (topic === undefined) return <NotFoundPanel message="That topic does not exist." />

  const packs = snapshot.packs
    .filter((pack) => pack.topicId === topic.id && pack.archivedAt === null)
    .sort(byOrder)
  const ids = packs.map((pack) => pack.id)

  async function move(packId: string, offset: -1 | 1): Promise<void> {
    setBusyId(packId)

    try {
      await api.orderPacks(
        topic!.id,
        moveId(ids, packId, offset),
        snapshot.contentVersion,
      )
      await refresh()
    } catch (caught) {
      report(caught)
    } finally {
      setBusyId(null)
    }
  }

  async function archive(pack: AdminPack): Promise<void> {
    const confirmed = window.confirm(
      `Archive “${pack.title}”? It is hidden from children. The words stay in the word library.`,
    )
    if (!confirmed) return

    setBusyId(pack.id)

    try {
      await api.setPackArchived(pack.id, true, snapshot.contentVersion)
      await refresh()
    } catch (caught) {
      report(caught)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeading
        title={topic.title}
        description={`Packs in this topic. ${topic.titleZh}`}
        action={
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => navigate({ screen: "packNew", topicId: topic.id })}
          >
            New pack
          </button>
        }
      />

      <Breadcrumb
        items={[
          {
            label: "Topics",
            onClick: () => navigate({ screen: "topics" }),
          },
          { label: topic.title },
        ]}
      />

      {packs.length === 0 ? (
        <Panel>
          <p className="text-sm font-bold">No packs in this topic yet.</p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            Create the first pack to start adding words.
          </p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            onClick={() => navigate({ screen: "packNew", topicId: topic.id })}
          >
            New pack
          </button>
        </Panel>
      ) : (
        <ol className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">
          {packs.map((pack, index) => (
            <li
              key={pack.id}
              className="flex flex-wrap items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3 last:border-0"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--admin-canvas)] text-xs font-black text-[var(--admin-muted)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--admin-ink)]">
                  {pack.title}
                </p>
                <p className="text-[11px] text-[var(--admin-muted)]">
                  {pack.titleZh}
                </p>
              </div>
              <span className="text-[11px] font-bold text-[var(--admin-muted)]">
                {wordCount(snapshot.memberships, pack.id)} words
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  label={`Move ${pack.title} up`}
                  disabled={index === 0 || busyId !== null}
                  onClick={() => void move(pack.id, -1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={`Move ${pack.title} down`}
                  disabled={index === packs.length - 1 || busyId !== null}
                  onClick={() => void move(pack.id, 1)}
                >
                  ↓
                </IconButton>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--admin-purple)] hover:bg-[var(--admin-purple-pale)]"
                  onClick={() =>
                    navigate({ screen: "pack", packId: pack.id })
                  }
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--admin-muted)]"
                  title="Pack contents arrive with feature 30"
                  disabled
                >
                  Contents
                </button>
                <button
                  type="button"
                  className={`${DANGER_BUTTON} px-2.5 py-1.5 text-xs`}
                  disabled={busyId === pack.id}
                  onClick={() => void archive(pack)}
                >
                  Archive
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

function Breadcrumb({
  items,
}: {
  items: ReadonlyArray<{ label: string; onClick?: () => void }>
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex gap-2 text-xs font-bold">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index === 0 ? null : (
            <span className="text-[var(--admin-muted)]">/</span>
          )}
          {item.onClick === undefined ? (
            <span className="text-[var(--admin-muted)]">{item.label}</span>
          ) : (
            <button
              type="button"
              className="text-[var(--admin-purple)] hover:underline"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--admin-line)] text-xs font-black text-[var(--admin-muted)] hover:bg-[var(--admin-canvas)] disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function byOrder(left: AdminPack, right: AdminPack): number {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
}

function wordCount(
  memberships: ReadonlyArray<{ packId: string; wordIds: string[] }>,
  packId: string,
): number {
  return memberships.find((entry) => entry.packId === packId)?.wordIds.length ?? 0
}
