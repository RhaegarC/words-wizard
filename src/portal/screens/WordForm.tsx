import { useRef, useState, type FormEvent } from "react"

import type { AdminWord } from "../../shared/admin"
import type {
  WordCreatePayload,
  WordExamplePayload,
} from "../../shared/adminWrite"
import { MAX_EXAMPLES } from "../../shared/adminWrite"
import { AdminRequestError } from "../api"
import {
  FormField,
  INPUT_CLASS,
  IssueList,
  NotFoundPanel,
  PageHeading,
  Panel,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  issueMessages,
} from "./shared"
import type { ScreenProps } from "./types"

interface WordValues {
  text: string
  phonetic: string
  partOfSpeech: string
  meaningEn: string
  meaningZh: string
  definitionEn: string
  definitionZh: string
  examples: WordExamplePayload[]
  level: 1 | 2 | 3
  tags: string
  emoji: string
}

const EMPTY: WordValues = {
  text: "",
  phonetic: "",
  partOfSpeech: "",
  meaningEn: "",
  meaningZh: "",
  definitionEn: "",
  definitionZh: "",
  examples: [{ en: "", zh: "" }],
  level: 1,
  tags: "",
  emoji: "",
}

const LEVELS: ReadonlyArray<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: "Level 1 — first words" },
  { value: 2, label: "Level 2 — building" },
  { value: 3, label: "Level 3 — stretching" },
]

/**
 * The word editor, used for create and edit. A word is one shared record: every
 * pack that holds it shows the same fields, so a save changes every appearance.
 * There is deliberately no delete or archive control — words are kept forever.
 *
 * Creating from a pack (`#/words/new?pack=…`) sends the pack with the create
 * and lands on that pack's contents, so “add a word here” is one action.
 */
export function WordForm({
  route,
  snapshot,
  api,
  navigate,
  refresh,
  notify,
  report,
}: ScreenProps) {
  const wordId = route.screen === "word" ? route.wordId : null
  const packId = route.screen === "wordNew" ? route.packId : undefined
  const existing =
    wordId === null
      ? undefined
      : snapshot.words.find((word) => word.id === wordId)
  const pack =
    packId === undefined
      ? undefined
      : snapshot.packs.find((candidate) => candidate.id === packId)

  const [values, setValues] = useState<WordValues>(() =>
    existing === undefined ? EMPTY : fromWord(existing),
  )
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (wordId !== null && existing === undefined) {
    return <NotFoundPanel message="That word does not exist." />
  }

  if (wordId !== null && existing?.archivedAt !== null) {
    return (
      <Panel>
        <p className="text-sm font-bold">This word is archived.</p>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          Archived words cannot be edited or placed into packs.
        </p>
        <button
          type="button"
          className={`${SECONDARY_BUTTON} mt-4`}
          onClick={() => navigate({ screen: "words" })}
        >
          Back to Words
        </button>
      </Panel>
    )
  }

  if (packId !== undefined && pack === undefined) {
    return <NotFoundPanel message="That pack does not exist." />
  }

  function set<K extends keyof WordValues>(
    key: K,
    value: WordValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function setExample(index: number, side: "en" | "zh", value: string): void {
    setValues((current) => ({
      ...current,
      examples: current.examples.map((example, position) =>
        position === index ? { ...example, [side]: value } : example,
      ),
    }))
  }

  function addExample(): void {
    if (values.examples.length >= MAX_EXAMPLES) return

    setValues((current) => ({
      ...current,
      examples: [...current.examples, { en: "", zh: "" }],
    }))
  }

  function removeExample(index: number): void {
    setValues((current) => ({
      ...current,
      examples: current.examples.filter((_, position) => position !== index),
    }))
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const examples = values.examples.filter(
      (example) => example.en.trim() !== "" || example.zh.trim() !== "",
    )

    if (examples.length === 0) {
      setIssues(["Add at least one example with both English and Chinese."])
      return
    }

    if (
      examples.some(
        (example) => example.en.trim() === "" || example.zh.trim() === "",
      )
    ) {
      setIssues(["Every example needs both an English and a Chinese sentence."])
      return
    }

    const payload: WordCreatePayload = {
      text: values.text.trim(),
      phonetic: values.phonetic.trim(),
      partOfSpeech: values.partOfSpeech.trim(),
      meaningEn: values.meaningEn.trim(),
      meaningZh: values.meaningZh.trim(),
      definitionEn: values.definitionEn.trim(),
      definitionZh: values.definitionZh.trim(),
      examples: examples.map((example) => ({
        en: example.en.trim(),
        zh: example.zh.trim(),
      })),
      level: values.level,
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""),
      emoji: values.emoji.trim() === "" ? null : values.emoji.trim(),
    }

    setBusy(true)
    setIssues([])

    try {
      if (existing === undefined) {
        const result =
          packId === undefined
            ? await api.createWord(payload, snapshot.contentVersion)
            : await api.createWord(
                { ...payload, packId },
                snapshot.contentVersion,
              )

        await refresh()

        const created = result.word
        notify(
          packId === undefined
            ? "Word created."
            : `Word created and added to ${pack?.title ?? "the pack"}.`,
        )

        if (packId !== undefined) {
          navigate({ screen: "packContents", packId })
          return
        }

        if (created !== undefined) {
          navigate({ screen: "word", wordId: created.id })
          return
        }

        navigate({ screen: "words" })
        return
      }

      await api.updateWord(existing.id, payload, snapshot.contentVersion)
      await refresh()
      notify("Word saved. Every pack using it now shows the change.")
    } catch (caught) {
      setIssues(issueMessages(caught))
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  function imageFailure(caught: unknown): void {
    if (caught instanceof AdminRequestError) {
      // Auth and a stale version are the shell's business; a rejected file is
      // this card's.
      if (
        caught.status === 401 ||
        caught.status === 403 ||
        caught.code === "conflict"
      ) {
        report(caught)
        return
      }

      setImageError(caught.message)
      return
    }

    setImageError("The image could not be saved.")
    report(caught)
  }

  async function uploadImage(file: File): Promise<void> {
    if (existing === undefined) return

    setImageBusy(true)
    setImageError(null)

    try {
      await api.uploadWordImage(existing.id, file, snapshot.contentVersion)
      await refresh()
      notify("Image saved. Children see the new picture on their next refresh.")
    } catch (caught) {
      imageFailure(caught)
    } finally {
      setImageBusy(false)
    }
  }

  async function removeImage(): Promise<void> {
    if (existing === undefined || existing.image === null) return

    setImageBusy(true)
    setImageError(null)

    try {
      await api.removeWordImage(existing.id, snapshot.contentVersion)
      await refresh()
      notify("Image removed. The emoji is shown instead.")
    } catch (caught) {
      imageFailure(caught)
    } finally {
      setImageBusy(false)
    }
  }

  const back =
    packId !== undefined
      ? { label: `Back to ${pack?.title ?? "pack"}`, route: { screen: "packContents", packId } as const }
      : { label: "Back to Words", route: { screen: "words" } as const }

  return (
    <>
      <PageHeading
        title={existing === undefined ? "New word" : "Edit word"}
        description={
          existing === undefined
            ? "One shared record. Packs reuse it, so every field is worth getting right once."
            : `Editing “${existing.text}”. Saving changes every pack that uses it.`
        }
      />

      <IssueList issues={issues} />

      <form onSubmit={(event) => void save(event)} className="grid gap-5">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="English headword">
              <input
                className={INPUT_CLASS}
                required
                value={values.text}
                onChange={(event) => set("text", event.target.value)}
                placeholder="brave"
              />
            </FormField>
            <FormField label="Phonetic">
              <input
                className={INPUT_CLASS}
                required
                value={values.phonetic}
                onChange={(event) => set("phonetic", event.target.value)}
                placeholder="/breɪv/"
              />
            </FormField>
            <FormField label="Part of speech">
              <input
                className={INPUT_CLASS}
                required
                value={values.partOfSpeech}
                onChange={(event) => set("partOfSpeech", event.target.value)}
                placeholder="adjective"
              />
            </FormField>
            <FormField label="Level">
              <select
                className={INPUT_CLASS}
                value={values.level}
                onChange={(event) =>
                  set("level", Number(event.target.value) as 1 | 2 | 3)
                }
              >
                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </FormField>
            {existing === undefined ? null : (
              <FormField
                label="Id"
                hint="Derived from the headword once and never reused."
              >
                <input className={INPUT_CLASS} readOnly value={existing.id} />
              </FormField>
            )}
            <FormField label="Emoji" hint="Optional. One emoji, typed or pasted.">
              <input
                className={INPUT_CLASS}
                value={values.emoji}
                onChange={(event) => set("emoji", event.target.value)}
                placeholder="🦁"
              />
            </FormField>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-sm font-extrabold">Meanings and definitions</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="English meaning">
              <input
                className={INPUT_CLASS}
                required
                value={values.meaningEn}
                onChange={(event) => set("meaningEn", event.target.value)}
                placeholder="Ready to face danger."
              />
            </FormField>
            <FormField label="Chinese meaning">
              <input
                className={INPUT_CLASS}
                required
                value={values.meaningZh}
                onChange={(event) => set("meaningZh", event.target.value)}
                placeholder="勇敢的。"
              />
            </FormField>
            <FormField label="English definition">
              <textarea
                className={INPUT_CLASS}
                required
                rows={2}
                value={values.definitionEn}
                onChange={(event) => set("definitionEn", event.target.value)}
              />
            </FormField>
            <FormField label="Chinese definition">
              <textarea
                className={INPUT_CLASS}
                required
                rows={2}
                value={values.definitionZh}
                onChange={(event) => set("definitionZh", event.target.value)}
              />
            </FormField>
          </div>
        </Panel>

        {existing === undefined ? null : (
          <Panel>
            <h2 className="text-sm font-extrabold">Image</h2>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              The picture a child sees for this word. Without one, the emoji is
              shown.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {existing.image === null ? (
                <div className="grid h-32 w-32 place-items-center rounded-xl border border-dashed border-[var(--admin-line)] bg-[var(--admin-canvas)] p-3 text-center text-[11px] font-semibold text-[var(--admin-muted)]">
                  No image yet
                </div>
              ) : (
                <img
                  src={existing.image}
                  alt={existing.text}
                  className="h-32 w-32 rounded-xl border border-[var(--admin-line)] object-cover"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={imageBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file !== undefined) void uploadImage(file)
                  }}
                />
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  disabled={imageBusy}
                  onClick={() => fileInput.current?.click()}
                >
                  {imageBusy
                    ? "Uploading…"
                    : existing.image === null
                      ? "Upload image"
                      : "Replace image"}
                </button>
                {existing.image === null ? null : (
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    disabled={imageBusy}
                    onClick={() => void removeImage()}
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-[var(--admin-muted)]">
              PNG, JPEG, or WebP, up to 2 MB. Each upload gets a fresh address,
              so a replacement is never served from a stale cache.
            </p>
            {imageError === null ? null : (
              <p className="mt-2 text-xs font-bold text-[var(--admin-coral)]">
                {imageError}
              </p>
            )}
          </Panel>
        )}

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-extrabold">Examples</h2>
            <button
              type="button"
              className={`${SECONDARY_BUTTON} px-3 py-1.5 text-xs`}
              disabled={values.examples.length >= MAX_EXAMPLES}
              onClick={addExample}
            >
              Add example
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            At least one bilingual example. Up to {MAX_EXAMPLES}.
          </p>

          <ol className="mt-4 grid gap-3">
            {values.examples.map((example, index) => (
              <li key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <FormField label={`Example ${index + 1} — English`}>
                  <input
                    className={INPUT_CLASS}
                    value={example.en}
                    onChange={(event) =>
                      setExample(index, "en", event.target.value)
                    }
                    placeholder="The brave knight smiled."
                  />
                </FormField>
                <FormField label="Chinese">
                  <input
                    className={INPUT_CLASS}
                    value={example.zh}
                    onChange={(event) =>
                      setExample(index, "zh", event.target.value)
                    }
                    placeholder="勇敢的骑士笑了。"
                  />
                </FormField>
                <button
                  type="button"
                  className="self-end rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--admin-muted)] hover:bg-[var(--admin-canvas)] disabled:opacity-30"
                  disabled={values.examples.length === 1}
                  onClick={() => removeExample(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Tags"
              hint="Comma-separated. Used to find the word in the library."
            >
              <input
                className={INPUT_CLASS}
                value={values.tags}
                onChange={(event) => set("tags", event.target.value)}
                placeholder="abstract, emotions"
              />
            </FormField>
          </div>
          <p className="mt-4 text-xs text-[var(--admin-muted)]">
            {existing === undefined
              ? "Save the word first to add a picture. "
              : ""}
            Words are never deleted or archived; removing one from every pack
            hides it from children while it stays in the library.
          </p>
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => navigate(back.route)}
          >
            {back.label}
          </button>
        </div>
      </form>
    </>
  )
}

function fromWord(word: AdminWord): WordValues {
  return {
    text: word.text,
    phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech,
    meaningEn: word.meaningEn,
    meaningZh: word.meaningZh,
    definitionEn: word.definitionEn,
    definitionZh: word.definitionZh,
    examples:
      word.examples.length === 0
        ? [{ en: "", zh: "" }]
        : word.examples.map((example) => ({ ...example })),
    level: word.level,
    tags: word.tags.join(", "),
    emoji: word.emoji ?? "",
  }
}
