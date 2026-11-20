import {
  buildBadgeCatalogue,
  MEDAL_DEFINITIONS,
  topicIdFromTrophy,
  type BadgeDefinition,
  type BadgeFacts,
} from "@shared/badges"

import { getTopic, getTopics } from "../content"
import type { Locale } from "../i18n/locale"
import type { Translator } from "../i18n/messages"
import {
  badgeDescriptionKey,
  badgeNameKey,
  TROPHY_ARCHIVED_DESCRIPTION_KEY,
  TROPHY_ARCHIVED_NAME_KEY,
  TROPHY_DESCRIPTION_KEY,
  TROPHY_NAME_KEY,
} from "./badges"

/**
 * Feature 37. The catalogue the shelf renders. Live topics supply their trophy
 * in content order; a completed topic that has since left the course keeps its
 * trophy through `completedTopicIds`, with its id appended after the live ones.
 */
export function badgeCatalogueFor(
  facts: BadgeFacts,
): readonly BadgeDefinition[] {
  const liveTopicIds = getTopics().map((topic) => topic.id)
  const archivedTopicIds = facts.completedTopicIds.filter(
    (topicId) => !liveTopicIds.includes(topicId),
  )

  return buildBadgeCatalogue([...liveTopicIds, ...archivedTopicIds])
}

export interface BadgeCopy {
  name: string
  description: string
}

/** The localized name and description for one catalogue entry. */
export function badgeCopy(
  definition: BadgeDefinition,
  locale: Locale,
  t: Translator,
): BadgeCopy {
  if (definition.tier !== "trophy") {
    return {
      name: t(badgeNameKey(definition)),
      description: t(badgeDescriptionKey(definition)),
    }
  }

  const topic =
    definition.topicId === undefined
      ? undefined
      : getTopic(definition.topicId)

  if (topic === undefined) {
    return {
      name: t(TROPHY_ARCHIVED_NAME_KEY),
      description: t(TROPHY_ARCHIVED_DESCRIPTION_KEY),
    }
  }

  const topicName = locale === "zh" ? topic.titleZh : topic.title

  return {
    name: t(TROPHY_NAME_KEY, { topic: topicName }),
    description: t(TROPHY_DESCRIPTION_KEY, { topic: topicName }),
  }
}

/**
 * The same copy for an id that came from `newlyEarned`. A session's commit is
 * the only source of these ids, and it is read before any content reload.
 */
export function badgeCopyForId(
  id: string,
  locale: Locale,
  t: Translator,
): BadgeCopy {
  const topicId = topicIdFromTrophy(id)

  if (topicId !== null) {
    const topic = getTopic(topicId)

    if (topic === undefined) {
      return {
        name: t(TROPHY_ARCHIVED_NAME_KEY),
        description: t(TROPHY_ARCHIVED_DESCRIPTION_KEY),
      }
    }

    const topicName = locale === "zh" ? topic.titleZh : topic.title

    return {
      name: t(TROPHY_NAME_KEY, { topic: topicName }),
      description: t(TROPHY_DESCRIPTION_KEY, { topic: topicName }),
    }
  }

  const medal = MEDAL_DEFINITIONS.find((definition) => definition.id === id)

  if (medal === undefined) {
    return { name: id, description: "" }
  }

  return badgeCopy(medal, locale, t)
}
