import { useEffect, useRef, type ReactNode } from "react"

import { AvatarPortrait } from "../components/AvatarPortrait"
import { Brand } from "../components/Brand"
import { Icon, type IconName } from "../components/Icon"
import { getAvatarSet } from "../content"
import type { Profile } from "@shared/types"
import { useLocale } from "../i18n/LocaleProvider"
import type { MessageKey } from "../i18n/messages"
import { useRouter } from "../router/RouterContext"
import type { Route } from "../router/routes"

type NavId = "home" | "session" | "words" | "character"

type NavItem = {
  id: NavId
  route: Route
  label: MessageKey
  icon: IconName
}

const NAV: readonly NavItem[] = [
  {
    id: "home",
    route: { id: "home" },
    label: "common.screen.home",
    icon: "home",
  },
  {
    id: "session",
    route: { id: "session" },
    label: "home.practice",
    icon: "sparkle",
  },
  {
    id: "words",
    route: { id: "words", tab: "collection" },
    label: "home.myWords",
    icon: "book",
  },
  {
    id: "character",
    route: { id: "character" },
    label: "character.title",
    icon: "user",
  },
]

/** The session family and the detail screen keep the nav item they belong to. */
function activeNav(route: Route): NavId | null {
  switch (route.id) {
    case "home":
      return "home"
    case "session":
    case "session-intro":
    case "session-exercise":
    case "session-summary":
      return "session"
    case "words":
    case "word-detail":
      return "words"
    case "character":
      return "character"
    default:
      return null
  }
}

export type AppShellProps = {
  profile: Profile
  route: Route
  title: string
  /** Changes whenever the screen changes, driving scroll and focus reset. */
  routeKey: string
  children: ReactNode
}

/**
 * The frame every signed-in screen renders inside: a sidebar on wide screens,
 * a bottom bar on a phone, and the content slot. The title heading is hidden
 * visually but still receives focus after navigation for screen readers.
 */
export function AppShell({
  profile,
  route,
  title,
  routeKey,
  children,
}: AppShellProps) {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const active = activeNav(route)
  const avatar = getAvatarSet().find((entry) => entry.id === profile.avatar)

  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [routeKey])

  const navButtons = NAV.map((item) => (
    <button
      key={item.id}
      type="button"
      className={active === item.id ? "active" : undefined}
      aria-current={active === item.id ? "page" : undefined}
      onClick={() => navigate(item.route)}
    >
      <Icon name={item.icon} />
      <span>{t(item.label)}</span>
    </button>
  ))

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />

        <nav aria-label={t("common.appName")}>{navButtons}</nav>

        <button
          type="button"
          className="mini-profile"
          onClick={() => navigate({ id: "settings" })}
          aria-current={route.id === "settings" ? "page" : undefined}
        >
          {avatar ? (
            <AvatarPortrait avatar={avatar} />
          ) : (
            <span className="avatar-tile" aria-hidden="true">
              {profile.characterName.charAt(0)}
            </span>
          )}
          <span className="mini-profile-copy">
            <b>{profile.name}</b>
            <small>{t("home.wordWizard")}</small>
          </span>
          <Icon name="settings" size={16} />
        </button>
      </aside>

      <main key={routeKey} className="content">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
          {title}
        </h1>
        {children}
      </main>

      <nav className="mobile-nav" aria-label={t("common.appName")}>
        {navButtons}
      </nav>
    </div>
  )
}
