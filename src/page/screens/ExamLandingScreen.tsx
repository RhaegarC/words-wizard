import { Icon } from "../components/Icon"
import { getTopic } from "../content"
import { useExam } from "../exam/ExamProvider"
import { useLocale } from "../i18n/LocaleProvider"
import { useRouter } from "../router/RouterContext"

/**
 * Feature 35. The current topic's exam front door: the gate, the part count
 * and Start / Resume / Retake. The Worker owns availability; this screen only
 * renders it.
 */
export function ExamLandingScreen() {
  const { locale, t } = useLocale()
  const { navigate } = useRouter()
  const { topicId, ready, exam, error, reload } = useExam()
  const topic = topicId === null ? undefined : getTopic(topicId)

  if (!ready) {
    return (
      <section className="session-intro">
        <p role="status" className="session-loading">
          {t("exam.loading")}
        </p>
      </section>
    )
  }

  if (error === "no-topic" || exam === null) {
    return (
      <section className="session-intro">
        <p className="session-lead">{t("exam.error")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-hub" })}
        >
          {t("session.backHome")}
        </button>
      </section>
    )
  }

  if (error === "load" || error === "submit") {
    return (
      <section className="session-intro">
        <p className="form-error" role="alert">
          {t("exam.error")}
        </p>
        <button type="button" className="button primary" onClick={reload}>
          {t("common.retry")}
        </button>
      </section>
    )
  }

  const topicName =
    topic === undefined
      ? (topicId ?? "")
      : locale === "zh"
        ? topic.titleZh
        : topic.title
  const completed = exam.state?.completedAt != null
  const nextPart = completed ? 0 : (exam.state?.passedParts ?? 0)
  const passed = completed ? exam.parts.length : (exam.state?.passedParts ?? 0)
  const largestPart = Math.max(
    0,
    ...exam.parts.map((part) => part.wordIds.length),
  )

  if (!exam.gate.unlocked) {
    return (
      <section className="session-intro">
        <div className="session-orbit" aria-hidden="true">
          <Icon name="shield" size={38} />
        </div>
        <span className="eyebrow">{t("exam.title")}</span>
        <h2 className="session-title">{topicName}</h2>
        <p className="session-lead">{t("exam.locked")}</p>
        <p className="session-meta">
          {t("exam.gate", {
            introduced: exam.gate.introduced,
            total: exam.gate.total,
          })}
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session" })}
        >
          {t("session.goToSession")}
        </button>
      </section>
    )
  }

  if (completed) {
    return (
      <section className="session-intro">
        <div className="session-orbit" aria-hidden="true">
          <Icon name="sparkle" size={38} />
        </div>
        <span className="eyebrow">{t("exam.title")}</span>
        <h2 className="session-title">{topicName}</h2>
        <p className="session-lead">{t("exam.completed")}</p>
        <p className="session-meta">
          {t("exam.partsPassed", {
            passed,
            total: exam.parts.length,
          })}
        </p>
        <button
          type="button"
          className="button primary"
          onClick={() => navigate({ id: "session-exam-part", index: 0 })}
        >
          {t("exam.retake")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate({ id: "session-hub" })}
        >
          {t("exam.backToHub")}
        </button>
      </section>
    )
  }

  return (
    <section className="session-intro">
      <div className="session-orbit" aria-hidden="true">
        <Icon name="shield" size={38} />
      </div>
      <span className="eyebrow">{t("exam.title")}</span>
      <h2 className="session-title">{topicName}</h2>
      <p className="session-lead">{exam.stale ? t("exam.stale") : t("exam.lead")}</p>

      <div className="session-plan">
        <span>
          <b>{exam.parts.length}</b>
          {t("exam.partsLabel")}
        </span>
        <span>
          <b>{largestPart}</b>
          {t("exam.wordsPerPartLabel")}
        </span>
      </div>

      <p className="session-meta">
        {t("exam.partsPassed", {
          passed: exam.state?.passedParts ?? 0,
          total: exam.parts.length,
        })}
      </p>
      <p className="session-meta">
        {t("exam.gate", {
          introduced: exam.gate.introduced,
          total: exam.gate.total,
        })}
      </p>

      <button
        type="button"
        className="button primary"
        onClick={() => navigate({ id: "session-exam-part", index: nextPart })}
      >
        <Icon name="play" size={19} />
        {nextPart > 0
          ? t("exam.resume", { index: nextPart + 1 })
          : t("exam.start")}
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => navigate({ id: "session-hub" })}
      >
        {t("exam.backToHub")}
      </button>
    </section>
  )
}
