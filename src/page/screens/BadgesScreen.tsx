import type { Profile } from "@shared/types"

import { BadgeShelf } from "../components/BadgeShelf"
import { useLocale } from "../i18n/LocaleProvider"

/** The full badge catalogue, reached from the link beside the Profile title. */
export function BadgesScreen({ profile }: { profile: Profile }) {
  const { t } = useLocale()

  return (
    <section className="badges-page">
      <a className="back-action" href="#/settings">
        ← {t("common.screen.settings")}
      </a>
      <BadgeShelf profile={profile} />
    </section>
  )
}
