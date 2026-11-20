import type { TopicStatus } from "@shared/topicStatus"

import type { MessageKey } from "../i18n/messages"

/** The one label key per status, shared by the topic picker and the hub. */
export const TOPIC_STATUS_KEYS: Readonly<Record<TopicStatus, MessageKey>> = {
  none: "topics.status.none",
  learning: "topics.status.learning",
  completed: "topics.status.completed",
}
