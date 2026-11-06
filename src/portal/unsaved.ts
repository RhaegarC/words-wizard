/**
 * A screen with a working draft registers a leave guard so every way out —
 * sidebar, breadcrumb, back button — can ask before the draft is lost. The
 * portal draws one screen at a time, so a single current guard is enough.
 */
export type LeaveGuard = () => boolean

let current: LeaveGuard | null = null

export function setLeaveGuard(guard: LeaveGuard | null): void {
  current = guard
}

/** `true` when leaving may proceed; a guarded screen asks its question. */
export function confirmLeave(): boolean {
  return current === null || current()
}
