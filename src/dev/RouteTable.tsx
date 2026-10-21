import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { buildHash, ROUTE_SAMPLES, titleKeyFor } from "../router/routes"

export type RouteTableProps = {
  hasProfile: boolean
  onToggleProfile: (present: boolean) => void
}

/**
 * Dev-only screen at `#/__routes`. The production build replaces
 * `import.meta.env.DEV` with `false`, so this branch and its import are removed.
 */
export function RouteTable({ hasProfile, onToggleProfile }: RouteTableProps) {
  const { navigate } = useRouter()
  const { locale, setLocale, t } = useLocale()

  return (
    <main className="route-table">
      <h1>Route table</h1>
      <p className="route-table-note">
        Dev only. Every route is listed with the screen it will become.
      </p>

      <label className="route-table-toggle">
        <input
          type="checkbox"
          checked={hasProfile}
          onChange={(event) => onToggleProfile(event.target.checked)}
        />
        Simulate a profile with a character
      </label>

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
