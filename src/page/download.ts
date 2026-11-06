/**
 * Feature 14: hand one JSON document to the browser as a download. No network
 * request is made; the object URL lives only for the click.
 */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  anchor.style.display = "none"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  // Safari reads the blob after the click handler returns, so revoke on the
  // next task rather than in the same frame.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
