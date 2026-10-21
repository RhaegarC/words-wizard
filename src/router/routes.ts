/**
 * The route table from PRD Appendix A.2. Every route is a hash fragment, so the
 * parser is pure and needs no server rewrite. Adding a route here without adding
 * it to `Route` — or vice versa — is a compile error.
 */
export type WordsTab = "collection" | "wordbook"

export type WordsRoute = {
  id: "words"
  tab: WordsTab
}

export type WordDetailRoute = {
  id: "word-detail"
  wordId: string
}

export type Route = { id: "home" } | { id: "topics" } | { id: "session" } | {
  id: "session-intro"
} | { id: "session-exercise" } | {
  id: "session-summary"
} | WordsRoute | WordDetailRoute | { id: "character" } | { id: "review" } | {
  id: "review-summary"
} | { id: "settings" } | { id: "create" } | { id: "install" }

export type RouteId = Route["id"]

/** One canonical route per screen, used by tests and the dev route table. */
export const ROUTE_SAMPLES: readonly Route[] = [
  { id: "home" },
  { id: "topics" },
  { id: "session" },
  { id: "session-intro" },
  { id: "session-exercise" },
  { id: "session-summary" },
  { id: "words", tab: "collection" },
  { id: "words", tab: "wordbook" },
  { id: "word-detail", wordId: "w-build" },
  { id: "character" },
  { id: "review" },
  { id: "review-summary" },
  { id: "settings" },
  { id: "create" },
  { id: "install" },
]

const SIMPLE_HASHES: Record<Exclude<RouteId, "words" | "word-detail">, string> =
  {
    home: "#/home",
    topics: "#/topics",
    session: "#/session",
    "session-intro": "#/session/intro",
    "session-exercise": "#/session/exercise",
    "session-summary": "#/session/summary",
    character: "#/character",
    review: "#/review",
    "review-summary": "#/review/summary",
    settings: "#/settings",
    create: "#/create",
    install: "#/install",
  }

const TITLES: Record<RouteId, string> = {
  home: "Home",
  topics: "Choose a topic",
  session: "Today's session",
  "session-intro": "New words",
  "session-exercise": "Practice",
  "session-summary": "Session complete",
  words: "My Words",
  "word-detail": "Word",
  character: "Your buddy",
  review: "Monthly Review",
  "review-summary": "Review complete",
  settings: "Settings",
  create: "Create your buddy",
  install: "Install Words Wizard",
}

export function buildHash(route: Route): string {
  if (route.id === "words") {
    return `#/words?tab=${route.tab}`
  }

  if (route.id === "word-detail") {
    return `#/words/${encodeURIComponent(route.wordId)}`
  }

  return SIMPLE_HASHES[route.id]
}

/**
 * Return the route a hash names, or `null` when it names nothing supported.
 * Unknown hashes are resolved by the boot guard, never thrown on.
 */
export function parseHash(hash: string): Route | null {
  const split = splitHash(hash)

  if (!split) {
    return null
  }

  const segments = split.path.slice(1).split("/")

  switch (segments[0]) {
    case "home":
      return onlyOneSegment(segments) ? { id: "home" } : null
    case "topics":
      return onlyOneSegment(segments) ? { id: "topics" } : null
    case "character":
      return onlyOneSegment(segments) ? { id: "character" } : null
    case "review":
      if (onlyOneSegment(segments)) {
        return { id: "review" }
      }
      return segments.length === 2 && segments[1] === "summary"
        ? { id: "review-summary" }
        : null
    case "settings":
      return onlyOneSegment(segments) ? { id: "settings" } : null
    case "create":
      return onlyOneSegment(segments) ? { id: "create" } : null
    case "install":
      return onlyOneSegment(segments) ? { id: "install" } : null
    case "session":
      return parseSession(segments)
    case "words":
      return parseWords(segments, split.query)
    default:
      return null
  }
}

export function titleFor(route: Route): string {
  if (route.id === "words") {
    return route.tab === "collection" ? "Collection" : "Word Book"
  }

  return TITLES[route.id]
}

/** The screen a back affordance returns to, or `null` when there is none. */
export function parentOf(route: Route): Route | null {
  switch (route.id) {
    case "home":
    case "create":
      return null
    case "word-detail":
      return { id: "words", tab: "collection" }
    case "session-intro":
    case "session-exercise":
      return { id: "session" }
    case "topics":
    case "session":
    case "session-summary":
    case "words":
    case "character":
    case "review":
    case "review-summary":
    case "settings":
    case "install":
      return { id: "home" }
  }
}

type SplitHash = {
  path: string
  query: string
}

function splitHash(hash: string): SplitHash | null {
  if (!hash.startsWith("#")) {
    return null
  }

  const raw = hash.slice(1)

  if (raw === "" || raw === "/") {
    return null
  }

  const queryStart = raw.indexOf("?")
  const rawPath = queryStart === -1 ? raw : raw.slice(0, queryStart)
  const query = queryStart === -1 ? "" : raw.slice(queryStart + 1)

  if (!rawPath.startsWith("/")) {
    return null
  }

  const path =
    rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath

  return { path, query }
}

function onlyOneSegment(segments: string[]): boolean {
  return segments.length === 1
}

function parseSession(segments: string[]): Route | null {
  if (segments.length === 1) {
    return { id: "session" }
  }

  if (segments.length === 2) {
    switch (segments[1]) {
      case "intro":
        return { id: "session-intro" }
      case "exercise":
        return { id: "session-exercise" }
      case "summary":
        return { id: "session-summary" }
    }
  }

  return null
}

function parseWords(segments: string[], query: string): Route | null {
  if (segments.length === 1) {
    const tab = parseTab(query)
    return tab ? { id: "words", tab } : null
  }

  if (segments.length !== 2) {
    return null
  }

  let wordId: string

  try {
    wordId = decodeURIComponent(segments[1])
  } catch {
    return null
  }

  if (wordId.trim() === "") {
    return null
  }

  return { id: "word-detail", wordId }
}

function parseTab(query: string): WordsTab | null {
  const tab = new URLSearchParams(query).get("tab")

  if (tab === null) {
    return "collection"
  }

  return tab === "collection" || tab === "wordbook" ? tab : null
}
