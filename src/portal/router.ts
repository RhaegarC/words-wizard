/**
 * The portal's hash routes. Unlike the child app there is no signed-in guard
 * route: sign-in and Access Denied are states of the shell, not addresses.
 */

export const PORTAL_SCREENS = ["topics", "words", "archived"] as const

export type PortalScreen = typeof PORTAL_SCREENS[number]

/** An empty or unknown fragment lands on Topics rather than a 404 screen. */
export function parsePortalHash(hash: string): PortalScreen {
  const path = hash.replace(/^#/, "").replace(/^\//, "")
  const screen = path.split(/[/?]/)[0]

  return PORTAL_SCREENS.includes(screen as PortalScreen)
    ? (screen as PortalScreen)
    : "topics"
}

export function screenHref(screen: PortalScreen): string {
  return `#/${screen}`
}
