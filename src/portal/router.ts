/**
 * The portal's hash routes (features 28–29). Unlike the child app there is no
 * signed-in guard route: sign-in and Access Denied are states of the shell,
 * not addresses.
 *
 * Every topic and pack route lives under the Topics section so the sidebar
 * keeps highlighting it while a teacher drills into an editor.
 */

export const PORTAL_SECTIONS = ["topics", "words", "archived"] as const

export type PortalSection = typeof PORTAL_SECTIONS[number]

export type PortalRoute =
  | { readonly screen: "topics" }
  | { readonly screen: "topicNew" }
  | { readonly screen: "topic"; readonly topicId: string }
  | { readonly screen: "packs"; readonly topicId: string }
  | { readonly screen: "packNew"; readonly topicId: string }
  | { readonly screen: "pack"; readonly packId: string }
  | { readonly screen: "packContents"; readonly packId: string }
  | { readonly screen: "words" }
  | { readonly screen: "wordNew"; readonly packId?: string }
  | { readonly screen: "word"; readonly wordId: string }
  | { readonly screen: "archived"; readonly tab: "topics" | "packs" }

const DEFAULT_ROUTE: PortalRoute = { screen: "topics" }

function segments(hash: string): string[] {
  const path = hash
    .replace(/^#/, "")
    .split("?")[0]!
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")

  return path === "" ? [] : path.split("/")
}

/** `#/words/new?pack=craft-build-1` — the pack a new word is placed into. */
function queryOf(hash: string): URLSearchParams {
  const index = hash.indexOf("?")

  return index === -1
    ? new URLSearchParams()
    : new URLSearchParams(hash.slice(index + 1))
}

/** An empty or unknown fragment lands on Topics rather than a 404 screen. */
export function parsePortalHash(hash: string): PortalRoute {
  const parts = segments(hash)
  const [section, first, second, third] = parts

  if (section === "topics") {
    if (first === undefined || first === "") return { screen: "topics" }
    if (first === "new") return { screen: "topicNew" }
    if (second === undefined) return { screen: "topic", topicId: first }
    if (second !== "packs") return DEFAULT_ROUTE
    if (third === undefined) return { screen: "packs", topicId: first }
    if (third === "new" && parts.length === 4) {
      return { screen: "packNew", topicId: first }
    }

    return DEFAULT_ROUTE
  }

  if (section === "packs") {
    // A pack is addressed by its own globally unique id.
    if (first === undefined) return DEFAULT_ROUTE
    if (second === "contents" && parts.length === 3) {
      return { screen: "packContents", packId: first }
    }
    if (second !== undefined) return DEFAULT_ROUTE

    return { screen: "pack", packId: first }
  }

  if (section === "words") {
    if (first === undefined) return { screen: "words" }
    if (parts.length !== 2) return DEFAULT_ROUTE
    if (first === "new") {
      const packId = queryOf(hash).get("pack")?.trim()

      return packId === undefined || packId === ""
        ? { screen: "wordNew" }
        : { screen: "wordNew", packId }
    }

    return { screen: "word", wordId: first }
  }

  if (section === "archived") {
    return { screen: "archived", tab: first === "packs" ? "packs" : "topics" }
  }

  return DEFAULT_ROUTE
}

export function routeHref(route: PortalRoute): string {
  switch (route.screen) {
    case "topics":
      return "#/topics"
    case "topicNew":
      return "#/topics/new"
    case "topic":
      return `#/topics/${route.topicId}`
    case "packs":
      return `#/topics/${route.topicId}/packs`
    case "packNew":
      return `#/topics/${route.topicId}/packs/new`
    case "pack":
      return `#/packs/${route.packId}`
    case "packContents":
      return `#/packs/${route.packId}/contents`
    case "words":
      return "#/words"
    case "wordNew":
      return route.packId === undefined
        ? "#/words/new"
        : `#/words/new?pack=${encodeURIComponent(route.packId)}`
    case "word":
      return `#/words/${route.wordId}`
    case "archived":
      return `#/archived/${route.tab}`
  }
}

export function sectionOf(route: PortalRoute): PortalSection {
  switch (route.screen) {
    case "topics":
    case "topicNew":
    case "topic":
    case "packs":
    case "packNew":
    case "pack":
    case "packContents":
      return "topics"
    case "words":
    case "wordNew":
    case "word":
      return "words"
    case "archived":
      return "archived"
  }
}
