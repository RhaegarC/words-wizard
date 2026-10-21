import { WordArtwork } from "../components/WordArtwork"
import { getWord } from "../content"
import { wordDefinition, wordExample, wordMeaning } from "../i18n/content"
import { useLocale } from "../i18n/LocaleProvider"
import { useSession } from "../session/SessionProvider"

import { SessionFallback } from "./SessionFallback"

/**
 * The introduction card for one new word. Pronunciation is tap-to-hear and
 * never autoplays, per PRD §5.2.
 */
export function SessionIntroScreen() {
  const { locale, t } = useLocale()
  const { state, dispatch, speechAvailable, speakWord } = useSession()
  const planned = state.plan.words[state.wordIndex]
  const word = planned ? getWord(planned.wordId) : undefined

  if (state.phase !== "intro" || !planned || !word) {
    return <SessionFallback />
  }

  return (
    <section className="session-screen">
      <p className="session-badge">{t("session.badgeNew")}</p>

      <article className="word-card">
        <WordArtwork word={word} className="word-card-art" />

        <div className="word-card-heading">
          <h2 className="word-card-text">{word.text}</h2>
          <button
            type="button"
            className="listen-button"
            onClick={() => speakWord(word.text)}
            disabled={!speechAvailable}
            aria-label={`${t("session.listen")}: ${word.text}`}
          >
            <span aria-hidden="true">🔊</span>
          </button>
        </div>

        <p className="word-card-phonetic">
          {word.phonetic}
          <span className="word-card-pos">{word.partOfSpeech}</span>
        </p>

        <p className="word-card-meaning">{wordMeaning(word, locale)}</p>

        <dl className="word-card-fields">
          <div>
            <dt>{t("session.definitionLabel")}</dt>
            <dd>{wordDefinition(word, locale)}</dd>
          </div>
          <div>
            <dt>{t("words.example")}</dt>
            <dd>{wordExample(word, locale)}</dd>
          </div>
        </dl>
      </article>

      <button
        type="button"
        className="primary-button"
        onClick={() => dispatch({ type: "continueIntro" })}
      >
        {t("common.continue")}
      </button>
    </section>
  )
}
