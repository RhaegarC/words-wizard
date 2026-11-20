import { useState } from "react"

import { normalizeSpelling, type ExamAnswer } from "@shared/exam"
import { getWord } from "../content"
import { useExam } from "../exam/ExamProvider"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"
import { hasEnglishVoice, speak } from "../speech"

/**
 * Feature 35. One exam part, one word at a time. The child types a single
 * spelling; a miss ends the part through the Worker, which records the outcome
 * and returns the correct spelling. There are no tiles, hints or reveal.
 */
export function ExamPartScreen({ index }: { index: number }) {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const {
    topicId,
    ready,
    exam,
    error,
    result,
    submitting,
    submit,
    clearResult,
    reload,
  } = useExam()
  const [wordIndex, setWordIndex] = useState(0)
  const [value, setValue] = useState("")
  const [answers, setAnswers] = useState<ExamAnswer[]>([])

  if (!ready) {
    return (
      <section className="session-intro">
        <p role="status" className="session-loading">
          {t("exam.loading")}
        </p>
      </section>
    )
  }

  if (error === "stale") {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("exam.stale")}</p>
        <button
          type="button"
          className="button primary"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.start")}
        </button>
      </section>
    )
  }

  if (error === "load" || error === "submit" || exam === null || topicId === null) {
    return (
      <section className="session-intro">
        <p className="form-error" role="alert">
          {t("exam.error")}
        </p>
        <button type="button" className="button primary" onClick={reload}>
          {t("common.retry")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.backToExam")}
        </button>
      </section>
    )
  }

  const part = exam.parts[index]

  if (part === undefined) {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("exam.error")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.backToExam")}
        </button>
      </section>
    )
  }

  if (!exam.gate.unlocked) {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("exam.locked")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.backToExam")}
        </button>
      </section>
    )
  }

  if (result !== null) {
    return (
      <ExamOutcome
        passed={result.passed}
        missedWordId={result.missedWordId}
        correctSpelling={result.correctSpelling}
        hasNextPart={index + 1 < exam.parts.length}
        onNext={() =>
          navigate({ id: "session-exam-part", index: index + 1 })
        }
        onSummary={() => navigate({ id: "session-exam-summary" })}
        onRetake={() => {
          clearResult()
          setWordIndex(0)
          setAnswers([])
          setValue("")
        }}
        onBack={() => navigate({ id: "session-exam" })}
      />
    )
  }

  const nextPart = exam.state?.passedParts ?? 0

  if (exam.state?.completedAt == null && index !== nextPart) {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("exam.locked")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.backToExam")}
        </button>
      </section>
    )
  }

  const word = getWord(part.wordIds[wordIndex])

  if (word === undefined) {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("exam.error")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.backToExam")}
        </button>
      </section>
    )
  }

  const submitWord = async (): Promise<void> => {
    if (submitting || value.trim() === "") return

    const correct =
      normalizeSpelling(value) === normalizeSpelling(word.text)

    if (!correct) {
      await submit({
        topicId,
        partIndex: index,
        attemptId: crypto.randomUUID(),
        contentVersion: exam.contentVersion,
        missedWordId: word.id,
      })
      return
    }

    const nextAnswers = [...answers, { wordId: word.id, answer: value }]

    if (wordIndex + 1 < part.wordIds.length) {
      setAnswers(nextAnswers)
      setWordIndex(wordIndex + 1)
      setValue("")
      return
    }

    await submit({
      topicId,
      partIndex: index,
      attemptId: crypto.randomUUID(),
      contentVersion: exam.contentVersion,
      answers: nextAnswers,
    })
  }

  return (
    <section className="session-intro">
      <span className="eyebrow">
        {t("exam.partTitle", { index: index + 1, total: exam.parts.length })}
      </span>
      <p className="session-meta">
        {t("exam.wordOf", {
          current: wordIndex + 1,
          total: part.wordIds.length,
        })}
      </p>

      <h2 className="session-title">{word.phonetic}</h2>
      <p className="session-lead">{word.meaningEn}</p>
      <p className="session-lead">{word.meaningZh}</p>
      <p className="field-hint">{word.definitionEn}</p>
      <p className="field-hint">{word.definitionZh}</p>

      {hasEnglishVoice() ? (
        <button
          type="button"
          className="button secondary"
          onClick={() => speak(word.text)}
        >
          {t("session.listen")}
        </button>
      ) : null}

      <form
        className="exam-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submitWord()
        }}
      >
        <label className="name-field">
          <b>{t("exam.answerLabel")}</b>
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
            lang={locale}
          />
        </label>
        <button
          type="submit"
          className="button primary"
          disabled={submitting || value.trim() === ""}
        >
          {submitting ? t("common.loading") : t("exam.submit")}
        </button>
      </form>

      <button
        type="button"
        className="button secondary"
        onClick={() => navigate({ id: "session-exam" })}
      >
        {t("exam.backToExam")}
      </button>
    </section>
  )
}

function ExamOutcome({
  passed,
  missedWordId,
  correctSpelling,
  hasNextPart,
  onNext,
  onSummary,
  onRetake,
  onBack,
}: {
  passed: boolean
  missedWordId: string | null
  correctSpelling: string | null
  hasNextPart: boolean
  onNext: () => void
  onSummary: () => void
  onRetake: () => void
  onBack: () => void
}) {
  const { t } = useLocale()
  const missedWord = missedWordId === null ? undefined : getWord(missedWordId)

  return (
    <section className="session-intro">
      {passed ? (
        <>
          <h2 className="session-title">{t("exam.passedTitle")}</h2>
          <p className="session-lead">{t("exam.passedBody")}</p>
          {hasNextPart ? (
            <button type="button" className="button primary" onClick={onNext}>
              {t("exam.nextPart")}
            </button>
          ) : null}
          <button
            type="button"
            className={hasNextPart ? "button secondary" : "button primary"}
            onClick={onSummary}
          >
            {t("exam.summaryTitle")}
          </button>
        </>
      ) : (
        <>
          <h2 className="session-title">{t("exam.failedTitle")}</h2>
          <p className="session-lead">
            {t("exam.failedBody", {
              word: missedWord?.text ?? "",
              spelling: correctSpelling ?? "",
            })}
          </p>
          <button type="button" className="button primary" onClick={onRetake}>
            {t("exam.retakePart")}
          </button>
          <button type="button" className="button secondary" onClick={onBack}>
            {t("exam.backToExam")}
          </button>
        </>
      )}
    </section>
  )
}
