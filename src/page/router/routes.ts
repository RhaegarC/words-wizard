/**
 * The route table from PRD Appendix A.2. Every route is a hash fragment, so the
 * parser is pure and needs no server rewrite. Adding a route here without adding
 * it to `Route` — or vice versa — is a compile error.
 */
import type { MessageKey } from "../i18n/messages"

export type WordsTab = "collection" | "wordbook"

export type WordsRoute = {
  id: "words"
  tab: WordsTab
}

export type WordDetailRoute = {
  id: "word-detail"
  wordId: string
  /** The tab the child opened the word from; back returns there. */
  tab?: WordsTab
}

/** The topic picker can be reached from Settings, where back returns there. */
export type TopicsRoute = {
  id: "topics"
  from?: "settings"
}

/** One free-practice session pinned to the pack it practises. */
export type FreePracticeRoute = {
  id: "session-free-pack" | "session-free-exercise" | "session-free-summary"
  packId: string
}

export type Route =
  | { id: "home" }
  | TopicsRoute
  | { id: "session" }
  | { id: "session-intro" }
  | { id: "session-exercise" }
  | { id: "session-summary" }
  | { id: "session-hub" }
  | { id: "session-free" }
  | FreePracticeRoute
  | { id: "session-exam" }
  | { id: "session-exam-part"; index: number }
  | { id: "session-exam-summary" }
  | WordsRoute
  | WordDetailRoute
  | { id: "character" }
  | { id: "review" }
  | { id: "review-exercise" }
  | { id: "review-summary" }
  | { id: "badges" }
  | { id: "settings" }
  | { id: "create" }
  | { id: "install" }
  | { id: "signin" }

export type RouteId = Route["id"]

/** One canonical route per screen, used by tests and the dev route table. */
export const ROUTE_SAMPLES: readonly Route[] = [
  { id: "home" },
  { id: "topics" },
  { id: "topics", from: "settings" },
  { id: "session" },
  { id: "session-intro" },
  { id: "session-exercise" },
  { id: "session-summary" },
  { id: "session-hub" },
  { id: "session-free" },
  { id: "session-free-pack", packId: "craft-1" },
  { id: "session-free-exercise", packId: "craft-1" },
  { id: "session-free-summary", packId: "craft-1" },
  { id: "session-exam" },
  { id: "session-exam-part", index: 0 },
  { id: "session-exam-summary" },
  { id: "words", tab: "collection" },
  { id: "words", tab: "wordbook" },
  { id: "word-detail", wordId: "w-build" },
  { id: "character" },
  { id: "review" },
  { id: "review-exercise" },
  { id: "review-summary" },
  { id: "badges" },
  { id: "settings" },
  { id: "create" },
  { id: "install" },
  { id: "signin" },
]

const SIMPLE_HASHES: Record<
  Exclude<
    RouteId,
    | "words"
    | "word-detail"
    | "session-free-pack"
    | "session-free-exercise"
    | "session-free-summary"
    | "session-exam-part"
  >,
  string
> = {
  home: "#/home",
  topics: "#/topics",
  session: "#/session",
  "session-intro": "#/session/intro",
  "session-exercise": "#/session/exercise",
  "session-summary": "#/session/summary",
  "session-hub": "#/session/hub",
  "session-free": "#/session/free",
  "session-exam": "#/session/exam",
  "session-exam-summary": "#/session/exam/summary",
  character: "#/character",
  review: "#/review",
  "review-exercise": "#/review/exercise",
  "review-summary": "#/review/summary",
  badges: "#/badges",
  settings: "#/settings",
  create: "#/create",
  install: "#/install",
  signin: "#/signin",
}

const TITLE_KEYS: Record<Exclude<RouteId, "words">, MessageKey> = {
  home: "common.screen.home",
  topics: "common.screen.topics",
  session: "common.screen.session",
  "session-intro": "common.screen.sessionIntro",
  "session-exercise": "common.screen.sessionExercise",
  "session-summary": "common.screen.sessionSummary",
  "session-hub": "common.screen.sessionHub",
  "session-free": "common.screen.sessionFree",
  "session-free-pack": "common.screen.sessionFree",
  "session-free-exercise": "common.screen.sessionFree",
  "session-free-summary": "common.screen.sessionFree",
  "session-exam": "common.screen.sessionExam",
  "session-exam-part": "common.screen.sessionExam",
  "session-exam-summary": "common.screen.sessionExamSummary",
  "word-detail": "common.screen.wordDetail",
  character: "common.screen.character",
  review: "common.screen.review",
  "review-exercise": "common.screen.review",
  "review-summary": "common.screen.reviewSummary",
  badges: "common.screen.badges",
  settings: "common.screen.settings",
  create: "common.screen.create",
  install: "common.screen.install",
  signin: "common.screen.signin",
}

export function buildHash(route: Route): string {
  if (route.id === "words") {
    return `#/words?tab=${route.tab}`
  }

  if (route.id === "word-detail") {
    const base = `#/words/${encodeURIComponent(route.wordId)}`

    return route.tab === undefined ? base : `${base}?tab=${route.tab}`
  }

  if (route.id === "topics") {
    return route.from === "settings"
      ? "#/topics?from=settings"
      : SIMPLE_HASHES.topics
  }

  if (route.id === "session-exam-part") {
    return `#/session/exam/part/${route.index}`
  }

  if (
    route.id === "session-free-pack" ||
    route.id === "session-free-exercise" ||
    route.id === "session-free-summary"
  ) {
    const base = `#/session/free/${encodeURIComponent(route.packId)}`

    if (route.id === "session-free-pack") {
      return base
    }

    return `${base}/${
      route.id === "session-free-exercise" ? "exercise" : "summary"
    }`
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
    case "topics": {
      if (!onlyOneSegment(segments)) {
        return null
      }

      const from = new URLSearchParams(split.query).get("from")

      return from === "settings"
        ? { id: "topics", from: "settings" }
        : { id: "topics" }
    }
    case "character":
      return onlyOneSegment(segments) ? { id: "character" } : null
    case "review":
      if (onlyOneSegment(segments)) {
        return { id: "review" }
      }

      if (segments.length !== 2) {
        return null
      }

      switch (segments[1]) {
        case "exercise":
          return { id: "review-exercise" }
        case "summary":
          return { id: "review-summary" }
        default:
          return null
      }
    case "settings":
      return onlyOneSegment(segments) ? { id: "settings" } : null
    case "badges":
      return onlyOneSegment(segments) ? { id: "badges" } : null
    case "create":
      return onlyOneSegment(segments) ? { id: "create" } : null
    case "install":
      return onlyOneSegment(segments) ? { id: "install" } : null
    case "signin":
      return onlyOneSegment(segments) ? { id: "signin" } : null
    case "session":
      return parseSession(segments)
    case "words":
      return parseWords(segments, split.query)
    default:
      return null
  }
}

export function titleKeyFor(route: Route): MessageKey {
  if (route.id === "words") {
    return route.tab === "collection"
      ? "words.collectionTitle"
      : "words.wordBookTitle"
  }

  return TITLE_KEYS[route.id]
}

/** The screen a back affordance returns to, or `null` when there is none. */
export function parentOf(route: Route): Route | null {
  switch (route.id) {
    case "home":
    case "create":
    case "signin":
      return null
    case "word-detail":
      return { id: "words", tab: route.tab ?? "collection" }
    case "session-intro":
    case "session-exercise":
      return { id: "session" }
    case "session-hub":
      return { id: "home" }
    case "session-exam":
      return { id: "session-hub" }
    case "session-exam-part":
    case "session-exam-summary":
      return { id: "session-exam" }
    case "session-free":
      return { id: "session-hub" }
    case "session-free-pack":
      return { id: "session-free" }
    case "session-free-exercise":
    case "session-free-summary":
      return { id: "session-free-pack", packId: route.packId }
    case "review-exercise":
      return { id: "review" }
    case "topics":
      return route.from === "settings"
        ? { id: "settings" }
        : { id: "home" }
    case "session":
    case "session-summary":
    case "words":
    case "character":
    case "review":
    case "badges":
      return { id: "settings" }
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
      case "hub":
        return { id: "session-hub" }
      case "free":
        return { id: "session-free" }
      case "intro":
        return { id: "session-intro" }
      case "exercise":
        return { id: "session-exercise" }
      case "summary":
        return { id: "session-summary" }
    }
  }

  if (segments[1] === "free" && (segments.length === 3 || segments.length === 4)) {
    const phase =
      segments.length === 3
        ? "pack"
        : segments[3] === "exercise"
          ? "exercise"
          : segments[3] === "summary"
            ? "summary"
            : null

    return phase === null ? null : freePracticeRoute(segments[2], phase)
  }

  if (segments[1] === "exam") {
    if (segments.length === 2) {
      return { id: "session-exam" }
    }

    if (segments.length === 3 && segments[2] === "summary") {
      return { id: "session-exam-summary" }
    }

    if (segments.length === 4 && segments[2] === "part") {
      if (!/^\d+$/.test(segments[3])) {
        return null
      }

      const index = Number(segments[3])

      return Number.isSafeInteger(index) && index >= 0
        ? { id: "session-exam-part", index }
        : null
    }
  }

  return null
}

function freePracticeRoute(
  rawPackId: string,
  phase: "pack" | "exercise" | "summary",
): Route | null {
  let packId: string

  try {
    packId = decodeURIComponent(rawPackId)
  } catch {
    return null
  }

  if (packId.trim() === "") {
    return null
  }

  const id =
    phase === "pack"
      ? "session-free-pack"
      : phase === "exercise"
        ? "session-free-exercise"
        : "session-free-summary"

  return { id, packId }
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

  const tab = parseDetailTab(query)

  if (tab === null) {
    return null
  }

  return tab === undefined
    ? { id: "word-detail", wordId }
    : { id: "word-detail", wordId, tab }
}

/** A detail route has no tab unless the hash names one, unlike `#/words`. */
function parseDetailTab(query: string): WordsTab | undefined | null {
  const tab = new URLSearchParams(query).get("tab")

  if (tab === null) {
    return undefined
  }

  return tab === "collection" || tab === "wordbook" ? tab : null
}

function parseTab(query: string): WordsTab | null {
  const tab = new URLSearchParams(query).get("tab")

  if (tab === null) {
    return "collection"
  }

  return tab === "collection" || tab === "wordbook" ? tab : null
}
