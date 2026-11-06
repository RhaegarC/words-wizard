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
  | { readonly screen: "words" }
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
    return first === undefined ? DEFAULT_ROUTE : { screen: "pack", packId: first }
  }

  if (section === "words" && first === undefined) return { screen: "words" }

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
    case "words":
      return "#/words"
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
      return "topics"
    case "words":
      return "words"
    case "archived":
      return "archived"
  }
}
