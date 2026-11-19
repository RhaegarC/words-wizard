import { getTopic } from "../content"
import { useExam } from "../exam/ExamProvider"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * Feature 35. The exam summary: parts passed and the topic's completion. It
 * deliberately shows no XP or stage change — the exam is assessment only.
 */
export function ExamSummaryScreen() {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { topicId, ready, exam, error } = useExam()
  const topic = topicId === null ? undefined : getTopic(topicId)

  if (!ready) {
    return (
      <section className="summary">
        <p role="status" className="session-loading">
          {t("exam.loading")}
        </p>
      </section>
    )
  }

  if (error !== null || exam === null) {
    return (
      <section className="summary">
        <p className="form-error" role="alert">
          {t("exam.error")}
        </p>
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

  const completed = exam.state?.completedAt != null
  const passed = completed
    ? exam.parts.length
    : (exam.state?.passedParts ?? 0)
  const topicName =
    topic === undefined
      ? (topicId ?? "")
      : locale === "zh"
        ? topic.titleZh
        : topic.title

  return (
    <section className="summary">
      <p className="summary-art" aria-hidden="true">
        🏆
      </p>

      <span className="eyebrow">{t("exam.title")}</span>
      <h2 className="summary-title">{t("exam.summaryTitle")}</h2>
      <p className="summary-xp">
        {completed
          ? t("exam.summaryBody", { topic: topicName })
          : t("exam.partsPassed", { passed, total: exam.parts.length })}
      </p>

      <div className="summary-grid">
        <span>
          <b>
            {passed} / {exam.parts.length}
          </b>
          <small>{t("exam.partsLabel")}</small>
        </span>
        <span>
          <b>{exam.state?.attempts ?? 0}</b>
          <small>{t("exam.attemptsLabel")}</small>
        </span>
      </div>

      {completed ? (
        <button
          type="button"
          className="button primary wide"
          onClick={() => navigate({ id: "session-exam-part", index: 0 })}
        >
          {t("exam.retake")}
        </button>
      ) : (
        <button
          type="button"
          className="button primary wide"
          onClick={() => navigate({ id: "session-exam" })}
        >
          {t("exam.backToExam")}
        </button>
      )}
      <button
        type="button"
        className="button secondary wide"
        onClick={() => navigate({ id: "home" })}
      >
        {t("exam.backHome")}
      </button>
    </section>
  )
}
