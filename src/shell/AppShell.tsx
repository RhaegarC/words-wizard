import { useEffect, useRef, type ReactNode } from "react"

import { useLocale } from "../i18n/LocaleProvider"

export type AppShellProps = {
  title: string
  /** Changes whenever the screen changes, driving scroll and focus reset. */
  routeKey: string
  onBack?: () => void
  children: ReactNode
}

/**
 * The single frame every screen renders inside: a back affordance, the screen
 * title (which receives focus after navigation), and the content slot.
 */
export function AppShell({ title, routeKey, onBack, children }: AppShellProps) {
  const { t } = useLocale()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [routeKey])

  return (
    <div className="app-shell">
      <header className="app-header">
        {onBack ? (
          <button
            type="button"
            className="shell-back"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            <span aria-hidden="true">←</span>
          </button>
        ) : (
          <span className="shell-back-spacer" aria-hidden="true" />
        )}
        <h1 ref={headingRef} tabIndex={-1} className="shell-title">
          {title}
        </h1>
      </header>

      <main key={routeKey} className="shell-content">
        {children}
      </main>
    </div>
  )
}
