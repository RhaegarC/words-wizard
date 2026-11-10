import type { AdminSnapshot } from "../../shared/admin"
import type { AdminApi } from "../api"
import type { PortalRoute } from "../router"

/** Everything a screen needs: the loaded snapshot, the write client, and the
 * shell actions. The snapshot is never null: the shell shows a loading panel
 * until the first read completes. */
export interface ScreenProps {
  readonly route: PortalRoute
  readonly snapshot: AdminSnapshot
  readonly api: AdminApi
  readonly navigate: (route: PortalRoute) => void
  readonly refresh: () => Promise<void>
  readonly notify: (message: string) => void
  readonly report: (caught: unknown) => void
}
