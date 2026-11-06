import { useEffect, useMemo, useState } from "react"

import type { AdminSnapshot } from "../../shared/admin"
import { MAX_MEMBERSHIP } from "../../shared/adminWrite"
import { addMembers, isDirty, removeMember } from "../membership"
import { moveId } from "../order"
import { setLeaveGuard } from "../unsaved"
import {
  INPUT_CLASS,
  NotFoundPanel,
  PageHeading,
  Panel,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "./shared"
import type { ScreenProps } from "./types"

const MAX_PICKER_RESULTS = 20
const UNSAVED_QUESTION =
  "Discard the unsaved changes to this pack's words?"

/**
 * Pack contents: the ordered word list a child meets. The screen edits a
 * working draft and commits the whole list on **Save changes**, because the
 * server replaces membership delete-then-insert in one atomic batch — a
 * partial renumber must never be visible to children.
 *
 * Every exit while the draft differs from the saved order asks first.
 */
export function PackContents({
  route,
  snapshot,
  api,
  navigate,
  refresh,
  notify,
  report,
}: ScreenProps) {
  const packId = route.screen === "packContents" ? route.packId : null
  const pack =
    packId === null
      ? undefined
      : snapshot.packs.find((candidate) => candidate.id === packId)
  const topic =
    pack === undefined
      ? undefined
      : snapshot.topics.find((candidate) => candidate.id === pack.topicId)

  const saved = pack === undefined ? [] : membershipOf(snapshot, pack.id)

  const [draft, setDraft] = useState<string[]>(() => saved)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)

  const dirty = isDirty(draft, saved)

  // Ask before any in-app exit: the sidebar, a breadcrumb, the back button.
  useEffect(() => {
    setLeaveGuard(dirty ? () => window.confirm(UNSAVED_QUESTION) : null)

    return () => setLeaveGuard(null)
  }, [dirty])

  // And before a reload, a close, or a typed address.
  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  const candidates = useMemo(
    () => (pack === undefined ? [] : pickerWords(snapshot, draft, query)),
    [snapshot, draft, query, pack],
  )

  const words = useMemo(
    () => new Map(snapshot.words.map((word) => [word.id, word])),
    [snapshot.words],
  )

  if (packId !== null && pack === undefined) {
    return <NotFoundPanel message="That pack does not exist." />
  }

  if (pack !== undefined && topic !== undefined && topic.archivedAt !== null) {
    return (
      <Panel>
        <p className="text-sm font-bold">The topic holding this pack is archived.</p>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          Restore it from the Archived view before editing the pack’s words.
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

  if (pack !== undefined && pack.archivedAt !== null) {
    return (
      <Panel>
        <p className="text-sm font-bold">This pack is archived.</p>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          Restore it from the Archived view to change which words it teaches.
        </p>
        <button
          type="button"
          className={`${SECONDARY_BUTTON} mt-4`}
          onClick={() => navigate({ screen: "archived", tab: "packs" })}
        >
          Open Archived
        </button>
      </Panel>
    )
  }

  if (pack === undefined) {
    return <NotFoundPanel message="That pack does not exist." />
  }

  const inPack = new Set(draft)

  function back(): void {
    // `navigate` consults this screen's leave guard; this button must too.
    if (dirty && !window.confirm(UNSAVED_QUESTION)) return

    setLeaveGuard(null)
    navigate({ screen: "packs", topicId: pack!.topicId })
  }

  async function save(): Promise<void> {
    setBusy(true)

    try {
      const result = await api.saveMembership(
        pack!.id,
        draft,
        snapshot.contentVersion,
      )
      await refresh()

      notify(
        result.warnings.length === 0
          ? "Pack contents saved. Children see the change now."
          : `Pack contents saved with ${result.warnings.length} editorial ${
              result.warnings.length === 1 ? "warning" : "warnings"
            }.`,
      )
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeading
        title={pack.title}
        description={`Words in this pack, in the order children meet them. ${pack.titleZh}`}
        action={
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => navigate({ screen: "pack", packId: pack!.id })}
          >
            Edit pack details
          </button>
        }
      />

      <nav aria-label="Breadcrumb" className="mb-4 flex gap-2 text-xs font-bold">
        <button
          type="button"
          className="text-[var(--admin-purple)] hover:underline"
          onClick={back}
        >
          {topic?.title ?? "Topic"}
        </button>
        <span className="text-[var(--admin-muted)]">/</span>
        <span className="text-[var(--admin-muted)]">Pack contents</span>
      </nav>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold">Words in this pack</h2>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              {draft.length} {draft.length === 1 ? "word" : "words"} in order.
              {dirty
                ? " Unsaved changes — children still see the saved order."
                : " Every change is live as soon as you save."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={!dirty || busy}
              onClick={() => setDraft([...saved])}
            >
              Discard changes
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={!dirty || busy}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {draft.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--admin-line)] p-6 text-center">
            <p className="text-sm font-bold">No words in this pack yet.</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Search the word library below, or create a word straight into this
              pack.
            </p>
          </div>
        ) : (
          <ol className="mt-5 overflow-hidden rounded-xl border border-[var(--admin-line)]">
            {draft.map((wordId, index) => {
              const word = words.get(wordId)

              return (
                <li
                  key={wordId}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--admin-line)] px-3 py-2.5 last:border-0"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--admin-canvas)] text-xs font-black text-[var(--admin-muted)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[var(--admin-ink)]">
                      {word?.emoji ?? "📘"} {word?.text ?? wordId}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--admin-muted)]">
                      {word?.meaningZh ?? "Unknown word"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <IconButton
                      label={`Move ${word?.text ?? wordId} up`}
                      disabled={index === 0 || busy}
                      onClick={() =>
                        setDraft(moveId(draft, wordId, -1))
                      }
                    >
                      ↑
                    </IconButton>
                    <IconButton
                      label={`Move ${word?.text ?? wordId} down`}
                      disabled={index === draft.length - 1 || busy}
                      onClick={() => setDraft(moveId(draft, wordId, 1))}
                    >
                      ↓
                    </IconButton>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--admin-coral)] hover:bg-[var(--admin-coral-pale)] disabled:opacity-40"
                      disabled={busy}
                      onClick={() => setDraft(removeMember(draft, wordId))}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>

      <div className="mt-5">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold">Add from the word library</h2>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                Words are shared: adding one here never changes another pack.
              </p>
            </div>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() =>
                navigate({ screen: "wordNew", packId: pack!.id })
              }
            >
              Create a new word here
            </button>
          </div>

          <input
            className={`${INPUT_CLASS} mt-4`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headword, meaning, or tag…"
            aria-label="Search the word library"
          />

          {candidates.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--admin-muted)]">
              {query.trim() === ""
                ? "Every library word is already in this pack."
                : "No library word matches. Create it above if it is new."}
            </p>
          ) : (
            <ul className="mt-4 overflow-hidden rounded-xl border border-[var(--admin-line)]">
              {candidates.map((word) => {
                const otherPacks = packCount(snapshot, word.id)

                return (
                  <li
                    key={word.id}
                    className="flex items-center gap-3 border-b border-[var(--admin-line)] px-3 py-2.5 last:border-0"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--admin-purple-pale)]">
                      {word.emoji ?? "📘"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{word.text}</span>
                      <span className="block truncate text-[11px] text-[var(--admin-muted)]">
                        {word.meaningZh} · Level {word.level}
                        {otherPacks === 0
                          ? ""
                          : ` · in ${otherPacks} other ${
                              otherPacks === 1 ? "pack" : "packs"
                            }`}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--admin-purple)] hover:bg-[var(--admin-purple-pale)] disabled:opacity-40"
                      disabled={
                        inPack.has(word.id) || draft.length >= MAX_MEMBERSHIP
                      }
                      onClick={() => setDraft(addMembers(draft, [word.id]))}
                    >
                      Add
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {candidates.length === MAX_PICKER_RESULTS ? (
            <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
              Showing the first {MAX_PICKER_RESULTS} matches. Keep typing to narrow
              the list.
            </p>
          ) : null}
        </Panel>
      </div>
    </>
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

function membershipOf(snapshot: AdminSnapshot, packId: string): string[] {
  return [
    ...(snapshot.memberships.find((entry) => entry.packId === packId)?.wordIds ??
      []),
  ]
}

/** Active words not already in the draft, filtered by the search text. */
function pickerWords(
  snapshot: AdminSnapshot,
  draft: readonly string[],
  query: string,
): AdminSnapshot["words"] {
  const key = query.trim().toLowerCase()
  const inDraft = new Set(draft)

  return snapshot.words
    .filter((word) => word.archivedAt === null && !inDraft.has(word.id))
    .filter(
      (word) =>
        key === "" ||
        [word.text, word.meaningEn, word.meaningZh, ...word.tags]
          .join(" ")
          .toLowerCase()
          .includes(key),
    )
    .sort((left, right) => left.text.localeCompare(right.text))
    .slice(0, MAX_PICKER_RESULTS)
}

/** How many packs hold this word, across every topic. */
function packCount(snapshot: AdminSnapshot, wordId: string): number {
  return snapshot.memberships.filter((entry) => entry.wordIds.includes(wordId))
    .length
}
