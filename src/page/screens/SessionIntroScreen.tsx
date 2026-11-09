import { Icon } from "../components/Icon"
import { WordArtwork } from "../components/WordArtwork"
import { getWord } from "../content"
import { wordExample } from "../i18n/content"
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
    <article className="intro-card">
      <WordArtwork word={word} className="intro-art" />

      <span className="eyebrow">{t("session.meetWord")}</span>

      <div className="word-heading">
        <h2>{word.text}</h2>
        <strong lang="zh">{word.meaningZh}</strong>
        <button
          type="button"
          className="word-hear"
          onClick={() => speakWord(word.text)}
          disabled={!speechAvailable}
          aria-label={`${t("session.listen")}: ${word.text}`}
        >
          <Icon name="volume" />
        </button>
      </div>

      <p className="phonetic">
        {word.phonetic} · {word.partOfSpeech}
      </p>

      <div className="bilingual-definition">
        <p>
          <b>EN</b>
          {word.definitionEn}
        </p>
        <p>
          <b>中文</b>
          {word.definitionZh}
        </p>
      </div>

      <blockquote>{wordExample(word, locale)}</blockquote>

      <button
        type="button"
        className="button primary"
        onClick={() => dispatch({ type: "continueIntro" })}
      >
        {t("session.startSpelling")} <Icon name="arrow" />
      </button>
    </article>
  )
}
