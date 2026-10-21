import { useEffect, useState } from "react"

import { progressProvider } from "../db"
import { DEVICE_KEYS } from "../db/device"
import { readDiagnostics, type DbDiagnostics } from "../db/diagnostics"
import { isInstalled } from "../db/lifecycle"
import { METRIC_NAMES, type MetricName } from "../db/metrics"
import { counterRows, formatBytes } from "../domain/diagnostics"
import type { Metric } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import { METRIC_LABEL_KEYS } from "../i18n/metrics"
import { hasEnglishVoice } from "../speech"

interface DiagnosticsData {
  installed: boolean
  persisted: boolean | null
  speechAvailable: boolean
  usage: number | null
  quota: number | null
  counts: DbDiagnostics
  metrics: readonly Metric[]
}

/**
 * Feature 14: answers "is my data safe on this device?" and nothing more. It
 * never reads a word list or shows the child's name; counters are aggregate
 * numbers from PRD §15.
 */
export function SettingsDiagnostics({
  profileId,
}: {
  profileId: number | undefined
}) {
  const { t } = useLocale()
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    setFailed(false)

    void readAll(profileId)
      .then((next) => {
        if (active) {
          setData(next)
        }
      })
      .catch((reason: unknown) => {
        console.error("[settings] Could not read diagnostics", reason)

        if (active) {
          setFailed(true)
        }
      })

    return () => {
      active = false
    }
  }, [profileId, reloadKey])

  return (
    <section className="settings-section" aria-labelledby="settings-diagnostics">
      <h2 id="settings-diagnostics" className="settings-heading">
        {t("settings.diagnostics")}
      </h2>
      <p className="settings-copy">{t("settings.diagnosticsHint")}</p>

      {failed ? (
        <p role="alert" className="form-error">
          {t("errors.generic")}
        </p>
      ) : data === null ? (
        <p role="status" className="settings-loading">
          {t("common.loading")}
        </p>
      ) : (
        <>
          <dl className="settings-facts">
            <div>
              <dt>{t("settings.installStatus")}</dt>
              <dd>
                {data.installed ? t("settings.installed") : t("settings.browserTab")}
              </dd>
            </div>
            <div>
              <dt>{t("settings.persistence")}</dt>
              <dd>
                {data.persisted === null
                  ? t("settings.unknown")
                  : data.persisted
                    ? t("settings.yes")
                    : t("settings.no")}
              </dd>
            </div>
            <div>
              <dt>{t("settings.storageUsage")}</dt>
              <dd>{formatBytes(data.usage) ?? t("settings.unknown")}</dd>
            </div>
            <div>
              <dt>{t("settings.storageQuota")}</dt>
              <dd>{formatBytes(data.quota) ?? t("settings.unknown")}</dd>
            </div>
            <div>
              <dt>{t("settings.speech")}</dt>
              <dd>
                {data.speechAvailable ? t("settings.yes") : t("settings.no")}
              </dd>
            </div>
            <div>
              <dt>{t("settings.profiles")}</dt>
              <dd>{data.counts.profiles}</dd>
            </div>
            <div>
              <dt>{t("settings.progressRows")}</dt>
              <dd>{data.counts.progress}</dd>
            </div>
            <div>
              <dt>{t("settings.metricRows")}</dt>
              <dd>{data.counts.metrics}</dd>
            </div>
            <div>
              <dt>{t("settings.deviceRows")}</dt>
              <dd>{data.counts.device}</dd>
            </div>
          </dl>

          <h3 className="settings-subheading">{t("settings.counters")}</h3>
          <dl className="settings-facts">
            {counterRows(data.metrics).map((row) => (
              <div key={row.name}>
                <dt>{t(METRIC_LABEL_KEYS[row.name])}</dt>
                <dd>{formatCounter(row.name, row.value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <button
        type="button"
        className="secondary-button"
        onClick={() => setReloadKey((key) => key + 1)}
      >
        {t("settings.refresh")}
      </button>
    </section>
  )
}

function formatCounter(name: MetricName, value: number): string {
  // The review delta is a signed average, not a whole-event count.
  return name === METRIC_NAMES.reviewStrengthDelta
    ? value.toFixed(2)
    : String(value)
}

async function readAll(
  profileId: number | undefined,
): Promise<DiagnosticsData> {
  const [counts, metrics, persisted, estimate] = await Promise.all([
    readDiagnostics(),
    profileId === undefined
      ? Promise.resolve<Metric[]>([])
      : progressProvider.getMetrics(profileId),
    progressProvider.getDevice(DEVICE_KEYS.storagePersisted),
    readStorageEstimate(),
  ])

  return {
    installed: isInstalled(),
    persisted: typeof persisted === "boolean" ? persisted : null,
    speechAvailable: hasEnglishVoice(),
    usage: estimate.usage,
    quota: estimate.quota,
    counts,
    metrics,
  }
}

async function readStorageEstimate(): Promise<{
  usage: number | null
  quota: number | null
}> {
  try {
    const storage = navigator.storage

    if (storage === undefined) {
      return { usage: null, quota: null }
    }

    const estimate = await storage.estimate()

    return {
      usage: numberOrNull(estimate.usage),
      quota: numberOrNull(estimate.quota),
    }
  } catch {
    // Storage Manager is unavailable in some private contexts; the rest of
    // diagnostics is still worth showing.
    return { usage: null, quota: null }
  }
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
