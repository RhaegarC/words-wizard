import { METRIC_NAME_VALUES, type MetricName } from "../db/metrics"

import type { Metric } from "./types"

/**
 * Feature 14's diagnostics present local facts; none of these values leaves the
 * device, and the screen never shows the child's name or a word list.
 */

export interface CounterRow {
  name: MetricName
  value: number
}

const BYTE_UNITS = ["KB", "MB", "GB", "TB"] as const

/**
 * `null` means the browser did not give a number (no Storage Manager, an
 * exception, or a private context). Bytes stay bytes; above 1024 the next unit
 * carries one decimal, so 1024 is `1.0 KB`, not `1024 B`.
 */
export function formatBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return null
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }

  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(1)} ${BYTE_UNITS[unit]}`
}

/**
 * Every PRD §15 counter in a stable order, including the ones that have never
 * moved (shown as 0). Unknown names are not part of the contract and are
 * ignored rather than presented as if they were.
 */
export function counterRows(metrics: readonly Metric[]): CounterRow[] {
  const byName = new Map<string, number>()

  for (const metric of metrics) {
    byName.set(metric.name, metric.value)
  }

  return METRIC_NAME_VALUES.map((name) => ({
    name,
    value: byName.get(name) ?? 0,
  }))
}
