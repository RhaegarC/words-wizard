/** A topic's accent family, shared by topic cards, word tiles, and art tiles. */
const TONES: Record<string, string> = {
  "craft-and-build": "violet",
  "explore-and-discover": "blue",
  "puzzle-and-mystery": "yellow",
  "co-op-quest": "green",
  "battle-and-survive": "coral",
}

/**
 * The class that carries a topic's `--tone`/`--pale` pair. An unknown topic
 * falls back to violet, so a card is never left unpainted.
 */
export function topicTone(topicId: string | null | undefined): string {
  return (topicId !== null && topicId !== undefined && TONES[topicId]) || "violet"
}
