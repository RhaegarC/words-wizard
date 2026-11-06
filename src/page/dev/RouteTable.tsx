import { useState } from "react"

import { progressProvider } from "../api/provider"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { buildHash, ROUTE_SAMPLES, titleKeyFor } from "../router/routes"
import { resetLocalData, seedDevProfile } from "./devStore"

export type RouteTableProps = {
  hasProfile: boolean
}

/**
 * Dev-only screen at `#/__routes`. The production build replaces
 * `import.meta.env.DEV` with `false`, so this branch and its import are removed.
 *
 * Profile presence now comes from the real store; the buttons write through the
 * same provider the app uses, then reload so the boot guard runs again.
 */
export function RouteTable({ hasProfile }: RouteTableProps) {
  const { navigate } = useRouter()
  const { locale, setLocale, t } = useLocale()
  const [busy, setBusy] = useState(false)

  const run = (action: () => Promise<void>) => {
    setBusy(true)
    void action()
      .then(() => window.location.reload())
      .catch((error) => {
        console.error("[dev] store action failed", error)
        setBusy(false)
      })
  }

  return (
    <main className="route-table">
      <h1>Route table</h1>
      <p className="route-table-note">
        Dev only. Every route is listed with the screen it will become.
      </p>

      <p className="route-table-note" role="status">
        Stored profile: {hasProfile ? "present" : "absent"}
      </p>

      {hasProfile ? (
        <button
          type="button"
          className="dev-action"
          disabled={busy}
          onClick={() => run(resetLocalData)}
        >
          Clear local app data and reload
        </button>
      ) : (
        <button
          type="button"
          className="dev-action"
          disabled={busy}
          onClick={() => run(() => seedDevProfile(progressProvider))}
        >
          Seed a dev profile and one commit
        </button>
      )}

      <label className="route-table-toggle">
        <input
          type="checkbox"
          checked={locale === "zh"}
          onChange={(event) => setLocale(event.target.checked ? "zh" : "en")}
        />
        Chinese UI ({locale})
      </label>

      <ul className="route-table-list">
        {ROUTE_SAMPLES.map((route) => {
          const hash = buildHash(route)

          return (
            <li key={hash}>
              <a
                href={hash}
                onClick={(event) => {
                  event.preventDefault()
                  navigate(route)
                }}
              >
                <code>{hash}</code> — {t(titleKeyFor(route))}
              </a>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
