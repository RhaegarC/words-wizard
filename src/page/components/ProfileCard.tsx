import { useState, type ReactNode } from "react"

import { useLocale } from "../i18n/LocaleProvider"
import { Icon, type IconName } from "./Icon"

/**
 * Feature 38 follow-up. A Profile page card that starts folded: the header is
 * always visible and the body opens from the +/− control.
 */
export function ProfileCard({
  id,
  icon,
  title,
  hint,
  wide = false,
  defaultOpen = false,
  children,
}: {
  id: string
  icon: IconName
  title: ReactNode
  hint?: ReactNode
  wide?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = `${id}-body`

  return (
    <article
      className={`settings-card${wide ? " settings-card-wide" : ""}`}
      aria-labelledby={id}
      data-open={open}
    >
      <header>
        <Icon name={icon} />
        <div>
          <h3 id={id}>{title}</h3>
          {hint === undefined ? null : <p>{hint}</p>}
        </div>
        <button
          type="button"
          className="settings-fold"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true">{open ? "−" : "+"}</span>
          <span className="sr-only">
            {t(open ? "settings.collapse" : "settings.expand")}
          </span>
        </button>
      </header>

      <div id={bodyId} className="settings-card-body" hidden={!open}>
        {children}
      </div>
    </article>
  )
}
