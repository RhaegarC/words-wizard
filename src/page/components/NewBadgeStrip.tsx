import { topicIdFromTrophy } from "@shared/badges"

import { badgeCopyForId } from "../domain/badgeView"
import { useLocale } from "../i18n/LocaleProvider"

/**
 * Feature 37. The summary strip: badges this saved outcome crossed a threshold
 * for. It renders nothing when the commit was queued or crossed nothing, and
 * it disappears on reload because badges keep no seen state.
 */
export function NewBadgeStrip({ ids }: { ids: readonly string[] }) {
  const { locale, t } = useLocale()

  if (ids.length === 0) {
    return null
  }

  return (
    <section className="new-badge-strip" aria-labelledby="new-badge-title">
      <span id="new-badge-title" className="eyebrow">
        {t("badges.newBadge")}
      </span>
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <span aria-hidden="true">
              {topicIdFromTrophy(id) === null ? "🏅" : "🏆"}
            </span>
            {badgeCopyForId(id, locale, t).name}
          </li>
        ))}
      </ul>
    </section>
  )
}
