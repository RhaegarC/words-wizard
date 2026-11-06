import { useMemo, useState } from "react"

import type { AdminSnapshot, AdminWord } from "../../shared/admin"
import { PageHeading, PRIMARY_BUTTON, Panel } from "./shared"
import type { ScreenProps } from "./types"

/**
 * The word library: every master record, including words in no pack and
 * archived history. Words are never deleted or archived from the portal, so
 * this screen offers no such control — only search, open, and create.
 */
export function Words({ snapshot, navigate }: ScreenProps) {
  const [query, setQuery] = useState("")

  const packCounts = useMemo(() => packCountByWord(snapshot), [snapshot])
  const matches = useMemo(
    () => snapshot.words.filter((word) => matchesQuery(word, query)),
    [snapshot.words, query],
  )

  return (
    <>
      <PageHeading
        title="Words"
        description="The master vocabulary every pack draws from. Editing a word changes every pack that uses it."
        action={
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => navigate({ screen: "wordNew" })}
          >
            New word
          </button>
        }
      />

      <div className="mb-4">
        <input
          className="w-full rounded-xl border border-[var(--admin-line)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-purple)]"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search headword, meaning, phonetic, or tag…"
          aria-label="Search words"
        />
      </div>

      {snapshot.words.length === 0 ? (
        <Panel>
          <p className="text-sm font-bold">The word library is empty.</p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            Create the first word, then place it into any packs that should
            teach it.
          </p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} mt-4`}
            onClick={() => navigate({ screen: "wordNew" })}
          >
            New word
          </button>
        </Panel>
      ) : matches.length === 0 ? (
        <Panel>
          <p className="text-sm font-bold">No word matches “{query}”.</p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            Search matches the headword, both meanings, the phonetic, and tags.
          </p>
        </Panel>
      ) : (
        <ol className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">
          {matches.map((word) => {
            const usedIn = packCounts.get(word.id) ?? 0

            return (
              <li
                key={word.id}
                className="border-b border-[var(--admin-line)] last:border-0"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[var(--admin-canvas)]"
                  onClick={() =>
                    navigate({ screen: "word", wordId: word.id })
                  }
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--admin-purple-pale)] text-lg">
                    {word.emoji ?? "📘"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-extrabold text-[var(--admin-ink)]">
                        {word.text}
                      </span>
                      <span className="text-xs text-[var(--admin-muted)]">
                        {word.phonetic}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--admin-muted)]">
                      {word.meaningZh}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-[var(--admin-muted)]">
                    Level {word.level}
                  </span>
                  <UsageNote usedIn={usedIn} archived={word.archivedAt !== null} />
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {snapshot.words.length === matches.length ? null : (
        <p className="mt-3 text-[11px] font-semibold text-[var(--admin-muted)]">
          Showing {matches.length} of {snapshot.words.length} words.
        </p>
      )}
    </>
  )
}

function UsageNote({
  usedIn,
  archived,
}: {
  usedIn: number
  archived: boolean
}) {
  if (archived) {
    return (
      <span className="w-48 shrink-0 text-right text-[11px] font-bold text-[var(--admin-amber)]">
        Archived in the library
      </span>
    )
  }

  if (usedIn === 0) {
    return (
      <span className="w-48 shrink-0 text-right text-[11px] font-bold text-[var(--admin-coral)]">
        Not in any pack — hidden from children
      </span>
    )
  }

  return (
    <span className="w-48 shrink-0 text-right text-[11px] font-bold text-[var(--admin-muted)]">
      Used in {usedIn} {usedIn === 1 ? "pack" : "packs"}
    </span>
  )
}

/** How many distinct packs hold each word across the whole library. */
function packCountByWord(snapshot: AdminSnapshot): Map<string, number> {
  const counts = new Map<string, number>()

  for (const membership of snapshot.memberships) {
    for (const wordId of membership.wordIds) {
      counts.set(wordId, (counts.get(wordId) ?? 0) + 1)
    }
  }

  return counts
}

function matchesQuery(word: AdminWord, query: string): boolean {
  const key = query.trim().toLowerCase()
  if (key === "") return true

  return [word.text, word.meaningEn, word.meaningZh, word.phonetic, ...word.tags]
    .join(" ")
    .toLowerCase()
    .includes(key)
}
