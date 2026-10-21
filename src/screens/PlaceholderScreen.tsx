import type { Route } from "../router/routes"

/** The feature that replaces each placeholder, so a dead end is never silent. */
const FEATURE_FOR_ROUTE: Record<Route["id"], string> = {
  home: "11",
  topics: "06",
  session: "07",
  "session-intro": "07",
  "session-exercise": "07–08",
  "session-summary": "09",
  words: "12",
  "word-detail": "12",
  character: "10",
  review: "13",
  "review-summary": "13",
  settings: "14",
  create: "06",
  install: "15",
}

/**
 * Every route has a target from the day the shell lands. Each one names the
 * feature that will build it, so a placeholder never looks like a finished
 * screen and a link is never dead.
 */
export function PlaceholderScreen({ route }: { route: Route }) {
  return (
    <section className="placeholder-screen">
      <p className="placeholder-badge">Placeholder</p>
      <p className="placeholder-copy">
        This screen arrives with feature {FEATURE_FOR_ROUTE[route.id]}.
      </p>

      {route.id === "words" ? (
        <p className="placeholder-detail">Tab: {route.tab}</p>
      ) : null}

      {route.id === "word-detail" ? (
        <p className="placeholder-detail">Word id: {route.wordId}</p>
      ) : null}
    </section>
  )
}
