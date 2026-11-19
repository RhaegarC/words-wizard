import {
  badgeProgress,
  isBadgeUnlocked,
  MEDAL_CATEGORIES,
  MEDAL_DEFINITIONS,
  TOPIC_CATEGORY,
  type BadgeDefinition,
  type BadgeFacts,
} from "@shared/badges"
import type { Profile } from "@shared/types"

import { useBadgeFacts } from "../components/useBadgeFacts"
import { BADGE_CATEGORY_KEYS } from "../domain/badges"
import { badgeCatalogueFor, badgeCopy } from "../domain/badgeView"
import { useLocale } from "../i18n/LocaleProvider"

/**
 * Feature 37. The shelf itself: every medal grouped by the fact it counts, and
 * one trophy per live topic. Nothing here is stored, so the screen simply
 * derives the whole page from the same facts Home reads.
 */
export function BadgesScreen({ profile }: { profile: Profile }) {
  const { t } = useLocale()
  const { facts, failed } = useBadgeFacts(profile)

  if (failed) {
    return (
      <section className="badges-screen">
        <p className="form-error" role="alert">
          {t("errors.generic")}
        </p>
      </section>
    )
  }

  if (facts === null) {
    return (
      <section className="badges-screen">
        <p role="status" className="session-loading">
          {t("common.loading")}
        </p>
      </section>
    )
  }

  const catalogue = badgeCatalogueFor(facts)
  const trophies = catalogue.filter(
    (definition) => definition.tier === "trophy",
  )
  const earned = catalogue.filter((definition) =>
    isBadgeUnlocked(definition, facts),
  ).length

  return (
    <section className="badges-screen">
      <header className="badges-header">
        <span className="eyebrow">{t("badges.title")}</span>
        <h2>{t("badges.subtitle")}</h2>
        <p className="badges-count">
          {t("badges.progress", { current: earned, target: catalogue.length })}
        </p>
      </header>

      {MEDAL_CATEGORIES.map((category) => (
        <section
          key={category}
          className="badge-category"
          aria-labelledby={`badge-category-${category}`}
        >
          <h3 id={`badge-category-${category}`}>
            {t(BADGE_CATEGORY_KEYS[category])}
          </h3>
          <div className="badge-grid">
            {MEDAL_DEFINITIONS.filter(
              (definition) => definition.category === category,
            ).map((definition) => (
              <BadgeTile
                key={definition.id}
                definition={definition}
                facts={facts}
              />
            ))}
          </div>
        </section>
      ))}

      <section
        className="badge-category"
        aria-labelledby="badge-category-topics"
      >
        <h3 id="badge-category-topics">
          {t(BADGE_CATEGORY_KEYS[TOPIC_CATEGORY])}
        </h3>
        <div className="badge-grid">
          {trophies.map((definition) => (
            <BadgeTile
              key={definition.id}
              definition={definition}
              facts={facts}
            />
          ))}
        </div>
      </section>
    </section>
  )
}

function BadgeTile({
  definition,
  facts,
}: {
  definition: BadgeDefinition
  facts: BadgeFacts
}) {
  const { locale, t } = useLocale()
  const unlocked = isBadgeUnlocked(definition, facts)
  const progress = badgeProgress(definition, facts)
  const copy = badgeCopy(definition, locale, t)
  const trophy = definition.tier === "trophy"

  return (
    <article
      className="badge-tile"
      data-state={unlocked ? "earned" : "locked"}
    >
      <span className="badge-mark" aria-hidden="true">
        {trophy ? "🏆" : "🏅"}
      </span>
      <b>{copy.name}</b>
      <p>{copy.description}</p>
      <span className="badge-status">
        {unlocked
          ? t("badges.earned")
          : t("badges.progress", {
              current: progress.current,
              target: progress.target,
            })}
      </span>
    </article>
  )
}
