import {
  featuredBadge,
  isBadgeUnlocked,
  nextGoal,
  type BadgeFacts,
} from "@shared/badges"

import { badgeCatalogueFor, badgeCopy } from "../domain/badgeView"
import { useLocale } from "../i18n/LocaleProvider"

/**
 * Feature 37. Home's shelf: the featured badge and the nearest locked one.
 * Both are derived rules, so the card is a pure function of the facts.
 */
export function BadgeShelfCard({
  facts,
  onOpen,
}: {
  facts: BadgeFacts
  onOpen: () => void
}) {
  const { locale, t } = useLocale()
  const catalogue = badgeCatalogueFor(facts)
  const featured = featuredBadge(facts, catalogue)
  const goal = nextGoal(facts, catalogue)
  const featuredCopy = featured === null ? null : badgeCopy(featured, locale, t)
  const goalCopy = goal === null ? null : badgeCopy(goal.badge, locale, t)
  const earned = catalogue.filter((definition) =>
    isBadgeUnlocked(definition, facts),
  ).length

  return (
    <button type="button" className="feature-card badge-card" onClick={onOpen}>
      <i className="feature-icon feature-icon-badges" aria-hidden="true">
        🏅
      </i>

      <span className="feature-copy">
        <small>{t("home.badgesTitle")}</small>
        <b>{featuredCopy?.name ?? t("home.badgesEmpty")}</b>
        {featuredCopy === null ? null : (
          <em>{featuredCopy.description}</em>
        )}
        {goalCopy === null || goal === null ? null : (
          <span className="badge-next">
            {t("home.badgesNext", { name: goalCopy.name })}
            <span aria-hidden="true"> · </span>
            {t("badges.progress", {
              current: goal.current,
              target: goal.target,
            })}
          </span>
        )}
      </span>

      <span className="feature-pill">
        {t("badges.progress", {
          current: earned,
          target: catalogue.length,
        })}
      </span>
    </button>
  )
}
