import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react"

import { useLocale } from "../i18n/LocaleProvider"
import type { SpellingExercise } from "../modes"

export interface SpellingBoardProps {
  exercise: SpellingExercise
  disabled: boolean
  /** Called once the board is full; the mode module decides correctness. */
  onComplete: (letters: readonly string[]) => void
}

const DRAG_TYPE = "text/plain"

/**
 * Tap-to-place and drag-to-place over the same tiles. A placed tile is a
 * button, so tapping it returns the letter to the pool.
 *
 * The board checks only when every slot is filled: an incomplete word is not
 * an answer, so it never counts as a miss.
 */
export function SpellingBoard({
  exercise,
  disabled,
  onComplete,
}: SpellingBoardProps) {
  const { t } = useLocale()
  const slotCount = exercise.answer.length
  const [placed, setPlaced] = useState<readonly (string | null)[]>(() =>
    Array.from({ length: slotCount }, () => null),
  )
  const tilesById = useMemo(
    () => new Map(exercise.tiles.map((tile) => [tile.id, tile])),
    [exercise.tiles],
  )
  const placedIds = new Set(placed.filter((id): id is string => id !== null))
  const pool = exercise.tiles.filter((tile) => !placedIds.has(tile.id))
  const wasDisabled = useRef(disabled)

  // The completed word stays visible through the correct/retry/reveal
  // feedback. Only a retry clears the board, so the child starts fresh.
  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      setPlaced(Array.from({ length: slotCount }, () => null))
    }

    wasDisabled.current = disabled
  }, [disabled, slotCount])

  const commit = useCallback(
    (next: readonly (string | null)[]) => {
      if (!next.every((id) => id !== null)) {
        setPlaced(next)
        return
      }

      // The board's job ends at "the word is complete"; correctness belongs
      // to the mode module. The letters stay in place until the exercise
      // advances or a retry re-enables the board.
      setPlaced(next)
      onComplete(
        next.map((id) => tilesById.get(id as string)?.letter ?? ""),
      )
    },
    [onComplete, tilesById],
  )

  const placeAt = (tileId: string, slot?: number) => {
    // Only this exercise's own tiles may enter a slot, so dragging arbitrary
    // text onto the board cannot create a phantom tile.
    if (disabled || placedIds.has(tileId) || !tilesById.has(tileId)) {
      return
    }

    const requested =
      slot !== undefined && placed[slot] === null ? slot : -1
    const target = requested === -1 ? placed.indexOf(null) : requested

    if (target === -1) {
      return
    }

    const next = [...placed]
    next[target] = tileId
    commit(next)
  }

  const remove = (tileId: string) => {
    if (disabled) {
      return
    }

    setPlaced(placed.map((id) => (id === tileId ? null : id)))
  }

  const dropOnSlot = (event: DragEvent, slot: number) => {
    event.preventDefault()
    // Without this the drop bubbles to the row, which would place the same
    // tile a second time in the first empty slot.
    event.stopPropagation()
    const tileId = event.dataTransfer.getData(DRAG_TYPE)

    if (tileId !== "") {
      placeAt(tileId, slot)
    }
  }

  return (
    <div className="spelling-board">
      {exercise.firstLetter ? (
        <p className="spelling-hint">
          {t("exercise.firstLetter", { letter: exercise.firstLetter })}
        </p>
      ) : null}

      <div
        className="spelling-slots"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const tileId = event.dataTransfer.getData(DRAG_TYPE)

          if (tileId !== "") {
            placeAt(tileId)
          }
        }}
      >
        {placed.map((tileId, index) =>
          tileId === null ? (
            <span
              key={`slot-${index}`}
              className="letter-slot"
              aria-hidden="true"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropOnSlot(event, index)}
            />
          ) : (
            <button
              key={`slot-${index}`}
              type="button"
              className="letter-tile letter-tile-placed"
              disabled={disabled}
              aria-label={t("exercise.removeLetter", {
                letter: tilesById.get(tileId)?.letter ?? "",
              })}
              onClick={() => remove(tileId)}
            >
              {tilesById.get(tileId)?.letter}
            </button>
          ),
        )}
      </div>

      <div className="spelling-pool">
        {pool.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="letter-tile"
            draggable={!disabled}
            disabled={disabled}
            aria-label={t("exercise.letter", { letter: tile.letter })}
            onClick={() => placeAt(tile.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData(DRAG_TYPE, tile.id)
              event.dataTransfer.effectAllowed = "move"
            }}
          >
            {tile.letter}
          </button>
        ))}
      </div>
    </div>
  )
}
