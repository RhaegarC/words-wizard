import { useEffect, useState } from "react"

import type { LegacyImportOutcome } from "@shared/legacyImport"

import { progressProvider } from "../api/provider"
import {
  autoImportLegacy,
  buildLegacyImportPayload,
  type LegacyPayloadBuild,
} from "../db/legacyImport"
import {
  deleteLegacyDatabase,
  readLegacyLocalData,
  type LegacyDeleteResult,
  type LegacyReadResult,
} from "../db/localData"
import { useLocale } from "../i18n/LocaleProvider"
import { Icon } from "./Icon"

/**
 * The Settings fallback for the Mission 1 import (feature 27).
 *
 * Boot tries the import automatically; this card exists for the states boot
 * deliberately leaves alone: unreadable data, an empty profile, a failed
 * request, and a deletion another tab blocked. It renders nothing when there
 * is no legacy database.
 */

interface ImportedState {
  readonly summary: LegacyImportOutcome
  readonly deleted: LegacyDeleteResult
}

type Confirmation = "import" | "discard"

export function LegacyImportCard() {
  const { t } = useLocale()
  const [read, setRead] = useState<LegacyReadResult | null>(null)
  const [build, setBuild] = useState<LegacyPayloadBuild | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [imported, setImported] = useState<ImportedState | null>(null)
  const [deleteBlocked, setDeleteBlocked] = useState(false)
  const [discarded, setDiscarded] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  useEffect(() => {
    let active = true

    void readLegacyLocalData().then((result) => {
      if (!active) return
      setRead(result)
      setBuild(
        result.status === "ready" ? buildLegacyImportPayload(result) : null,
      )
    })

    return () => {
      active = false
    }
  }, [])

  const runImport = async () => {
    setConfirmation(null)
    if (read === null) return

    setBusy(true)
    setFailed(false)

    const status = await autoImportLegacy(progressProvider, {
      read: async () => read,
      remove: deleteLegacyDatabase,
    })

    setBusy(false)

    if (status.status === "imported") {
      setImported({ summary: status.summary, deleted: status.deleted })
      setBuild(null)
    } else {
      setFailed(true)
    }
  }

  const runDiscard = async () => {
    setConfirmation(null)
    setBusy(true)

    const deleted = await deleteLegacyDatabase()

    setBusy(false)

    if (deleted === "deleted") {
      setDiscarded(true)
    } else if (deleted === "blocked") {
      setDeleteBlocked(true)
    } else {
      setFailed(true)
    }
  }

  if (
    read === null ||
    read.status === "absent" ||
    discarded ||
    (imported !== null && imported.deleted === "deleted")
  ) {
    return null
  }

  const unreadable = read.status === "unreadable"
  const empty = !unreadable && build === null
  const blocked = deleteBlocked || imported?.deleted === "blocked"

  return (
    <article className="settings-card" aria-labelledby="settings-legacy">
      <header>
        <Icon name="download" />
        <div>
          <h3 id="settings-legacy">{t("settings.legacy.title")}</h3>
          <p>{t("settings.legacy.hint")}</p>
        </div>
      </header>

      {unreadable ? (
        <p className="settings-copy">{t("settings.legacy.unreadableBody")}</p>
      ) : imported !== null ? (
        <p className="settings-copy">
          {t("settings.legacy.importedBody", {
            words: imported.summary.progress.imported,
            skipped:
              imported.summary.progress.skipped +
              imported.summary.metrics.skipped,
          })}
        </p>
      ) : empty ? (
        <p className="settings-copy">{t("settings.legacy.emptyBody")}</p>
      ) : (
        <p className="settings-copy">
          {t("settings.legacy.foundBody", {
            words: build?.payload.progress.length ?? 0,
            metrics: build?.payload.metrics.length ?? 0,
          })}
        </p>
      )}

      {blocked ? (
        <p role="alert" className="form-error">
          {t("settings.legacy.blockedBody")}
        </p>
      ) : null}

      {failed ? (
        <p role="alert" className="form-error">
          {t("settings.legacy.failedBody")}
        </p>
      ) : null}

      <div className="settings-actions">
        {!unreadable && !empty && imported === null ? (
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => setConfirmation("import")}
          >
            {busy
              ? t("settings.legacy.importing")
              : failed
                ? t("settings.legacy.retry")
                : t("settings.legacy.import")}
          </button>
        ) : null}

        {blocked || (imported !== null && imported.deleted === "unavailable") ? (
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => setConfirmation("discard")}
          >
            {busy ? t("settings.legacy.importing") : t("settings.legacy.retry")}
          </button>
        ) : null}

        {imported === null ? (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setConfirmation("discard")}
          >
            {t("settings.legacy.discard")}
          </button>
        ) : null}
      </div>

      {confirmation !== null ? (
        <div
          className="modal-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirmation(null)
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legacy-confirm-title"
          >
            <h2 id="legacy-confirm-title" className="modal-title">
              {confirmation === "import"
                ? t("settings.legacy.importConfirmTitle")
                : t("settings.legacy.discardConfirmTitle")}
            </h2>
            <p className="modal-body">
              {confirmation === "import"
                ? t("settings.legacy.importConfirmBody")
                : t("settings.legacy.discardConfirmBody")}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmation(null)}
                autoFocus
              >
                {t("settings.legacy.cancel")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={
                  confirmation === "import" ? () => void runImport() : () => void runDiscard()
                }
              >
                {t("settings.legacy.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
