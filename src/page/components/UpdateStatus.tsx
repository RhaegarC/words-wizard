import { useLocale } from "../i18n/LocaleProvider"
import { useUpdateNotice } from "../pwa/UpdateProvider"

import { Icon } from "./Icon"

/**
 * PRD §8.7. A waiting worker is announced, never swapped under the child.
 * Later leaves the old worker in place; only Refresh asks for the new one.
 */
export function UpdateStatus() {
  const { t } = useLocale()
  const { state, refresh, later } = useUpdateNotice()

  if (state.status === "idle" || state.hidden) {
    return null
  }

  const updating = state.status === "updating"

  return (
    <section className="update-notice" role="status" aria-live="polite">
      <span className="update-icon" aria-hidden="true">
        <Icon name="download" />
      </span>
      <span className="update-copy">
        <b>{t("update.title")}</b>
        <small>{t("update.body")}</small>
      </span>
      <div className="update-actions">
        <button
          type="button"
          className="button primary"
          disabled={updating}
          onClick={refresh}
        >
          {updating ? t("update.updating") : t("update.refresh")}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={updating}
          onClick={later}
        >
          {t("update.later")}
        </button>
      </div>
    </section>
  )
}
