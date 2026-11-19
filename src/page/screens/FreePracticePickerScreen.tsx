import { Icon } from "../components/Icon"
import { useProfileProgress } from "../components/useProfileProgress"
import { getAllPacks, getAllWords } from "../content"
import { unlockedPacksFor } from "@shared/freePractice"
import type { Pack, Profile } from "@shared/types"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * Feature 34. One pack of the current topic, chosen from the packs that are
 * unlocked and have introduced words. The counts use the same rules as the
 * free-practice builder, so a card that looks ready cannot produce an empty
 * session.
 */
export function FreePracticePickerScreen({ profile }: { profile: Profile }) {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { progress, introductions, failed } = useProfileProgress(profile.id)

  if (progress === null || introductions === null) {
    return (
      <section className="word-page">
        <p role="status" className="words-loading">
          {t("common.loading")}
        </p>
      </section>
    )
  }

  if (failed) {
    return (
      <section className="word-page">
        <p className="form-error" role="alert">
          {t("errors.generic")}
        </p>
      </section>
    )
  }

  const packs = unlockedPacksFor(
    profile.currentTopicId,
    getAllPacks(),
    introductions,
  )
  const words = getAllWords()
  const wordIds = new Set(words.map((word) => word.id))
  const progressIds = new Set(
    progress
      .filter((row) => row.profileId === profile.id)
      .map((row) => row.wordId),
  )
  const introducedByPack = new Map<string, Set<string>>()

  for (const row of introductions) {
    const set = introducedByPack.get(row.packId) ?? new Set<string>()
    set.add(row.wordId)
    introducedByPack.set(row.packId, set)
  }

  const counts = new Map<string, { introduced: number; total: number }>()

  for (const pack of packs) {
    const introduced = introducedByPack.get(pack.id) ?? new Set<string>()
    const ids = [...new Set(pack.wordIds)].filter((wordId) =>
      wordIds.has(wordId),
    )

    counts.set(pack.id, {
      introduced: ids.filter(
        (wordId) => introduced.has(wordId) && progressIds.has(wordId),
      ).length,
      total: ids.length,
    })
  }

  return (
    <section className="word-page">
      <header>
        <div>
          <span className="eyebrow">{t("session.hub.freeTitle")}</span>
          <h2>{t("free.title")}</h2>
          <p>{t("free.lead")}</p>
        </div>
      </header>

      {packs.length === 0 ? (
        <div className="words-empty">
          <p className="words-empty-copy">{t("free.emptyTitle")}</p>
          <p className="words-empty-copy">{t("free.emptyBody")}</p>
          <button
            type="button"
            className="button primary"
            onClick={() => navigate({ id: "session" })}
          >
            {t("free.emptyAction")}
          </button>
        </div>
      ) : (
        <div className="feature-grid">
          {packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              locale={locale}
              count={counts.get(pack.id) ?? { introduced: 0, total: 0 }}
              onChoose={() =>
                navigate({ id: "session-free-pack", packId: pack.id })
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PackCard({
  pack,
  locale,
  count,
  onChoose,
}: {
  pack: Pack
  locale: "en" | "zh"
  count: { introduced: number; total: number }
  onChoose: () => void
}) {
  const { t } = useLocale()
  const ready = count.introduced > 0

  return (
    <button
      type="button"
      className="feature-card"
      disabled={!ready}
      onClick={onChoose}
    >
      <i className="feature-icon feature-icon-words" aria-hidden="true">
        <Icon name="book" size={28} />
      </i>
      <span className="feature-copy">
        <small>{locale === "zh" ? pack.titleZh : pack.title}</small>
        <b>
          {t("free.packMeta", {
            introduced: count.introduced,
            total: count.total,
          })}
        </b>
      </span>
      <Icon name="arrow" />
    </button>
  )
}
