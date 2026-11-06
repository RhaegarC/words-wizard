import { useState } from "react"

import type { AdminPack, AdminSnapshot, AdminTopic } from "../../shared/admin"
import {
  DANGER_BUTTON,
  PageHeading,
  PRIMARY_BUTTON,
  Panel,
} from "./shared"
import type { ScreenProps } from "./types"

/**
 * The topics list: one card per live topic in curated order, with the two
 * counts a teacher needs before opening it, and the archive action.
 */
export function TopicsList({
  snapshot,
  api,
  navigate,
  refresh,
  report,
}: ScreenProps) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const topics = snapshot.topics
    .filter((topic) => topic.archivedAt === null)
    .sort(byOrder)
  const livePacks = snapshot.packs.filter((pack) => pack.archivedAt === null)

  async function archive(topic: AdminTopic): Promise<void> {
    const confirmed = window.confirm(
      `Archive “${topic.title}”? Its packs and words are hidden from children. You can restore it from the Archived view.`,
    )
    if (!confirmed) return

    setBusyId(topic.id)

    try {
      await api.setTopicArchived(topic.id, true, snapshot.contentVersion)
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
        title="Topics"
        description="Manage the worlds learners choose from."
        action={
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => navigate({ screen: "topicNew" })}
          >
            New topic
          </button>
        }
      />

      {topics.length === 0 ? (
        <Panel>
          <p className="text-sm font-bold">No topics yet.</p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            Create the first topic to start building the vocabulary.
          </p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            onClick={() => navigate({ screen: "topicNew" })}
          >
            New topic
          </button>
        </Panel>
      ) : (
        <ul className="grid gap-4">
          {topics.map((topic) => {
            const packs = livePacks.filter((pack) => pack.topicId === topic.id)

            return (
              <li
                key={topic.id}
                className="rounded-[15px] border border-[var(--admin-line)] bg-white p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--admin-purple-pale)] text-2xl">
                    {topic.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold text-[var(--admin-ink)]">
                      {topic.title}
                    </h2>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {topic.titleZh}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--admin-muted)]">
                      {topic.description}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-[var(--admin-muted)]">
                      {packs.length} {packs.length === 1 ? "pack" : "packs"} ·{" "}
                      {wordCount(snapshot, packs)}{" "}
                      {wordCount(snapshot, packs) === 1 ? "word" : "words"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--admin-purple)] hover:bg-[var(--admin-purple-pale)]"
                      onClick={() =>
                        navigate({ screen: "topic", topicId: topic.id })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--admin-purple)] hover:bg-[var(--admin-purple-pale)]"
                      onClick={() =>
                        navigate({ screen: "packs", topicId: topic.id })
                      }
                    >
                      View packs
                    </button>
                    <button
                      type="button"
                      className={`${DANGER_BUTTON} px-2.5 py-1.5 text-xs`}
                      disabled={busyId === topic.id}
                      onClick={() => void archive(topic)}
                    >
                      {busyId === topic.id ? "Archiving…" : "Archive"}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function byOrder(left: AdminTopic, right: AdminTopic): number {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
}

/** Distinct words across the topic's live packs. */
function wordCount(
  snapshot: AdminSnapshot,
  packs: readonly AdminPack[],
): number {
  const packIds = new Set(packs.map((pack) => pack.id))
  const words = new Set<string>()

  for (const membership of snapshot.memberships) {
    if (!packIds.has(membership.packId)) continue
    for (const wordId of membership.wordIds) words.add(wordId)
  }

  return words.size
}
