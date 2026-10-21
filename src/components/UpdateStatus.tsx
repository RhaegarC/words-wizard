import { useLocale } from "../i18n/LocaleProvider"
import { useUpdateNotice } from "../pwa/UpdateProvider"

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
      <p className="update-title">{t("update.title")}</p>
      <p className="update-body">{t("update.body")}</p>
      <div className="update-actions">
        <button
          type="button"
          className="primary-button"
          disabled={updating}
          onClick={refresh}
        >
          {updating ? t("update.updating") : t("update.refresh")}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={updating}
          onClick={later}
        >
          {t("update.later")}
        </button>
      </div>
    </section>
  )
}
