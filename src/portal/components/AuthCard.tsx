import type { ReactNode } from "react"

import { Brand } from "./Brand"

/**
 * The whole portal before the staff gate opens: a signed-out card, Access
 * Denied, or a quiet loading card while MSAL restores the redirect.
 */
export function AuthCard({
  state,
  email,
  expired = false,
  onSignIn,
  onSignOut,
}: {
  state: "loading" | "signed-out" | "denied"
  email?: string
  expired?: boolean
  onSignIn?: () => void
  onSignOut?: () => void
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--admin-purple-pale)] p-5 text-[var(--admin-ink)]">
      <section className="w-full max-w-[430px] rounded-2xl border border-white/80 bg-white p-9 text-center shadow-[0_22px_65px_rgba(48,39,71,0.12)]">
        <div className="mb-7 flex justify-center">
          <Brand />
        </div>

        {state === "loading" && (
          <>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
              Words Wizard Admin
            </h1>
            <p className="mt-3 text-sm text-[var(--admin-muted)]">
              Restoring your session…
            </p>
          </>
        )}

        {state === "signed-out" && (
          <>
            {expired && (
              <p className="mb-5 rounded-xl bg-[var(--admin-amber-pale)] px-3 py-2.5 text-xs font-bold text-[var(--admin-amber)]">
                Your session expired. Sign in again to continue.
              </p>
            )}
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
              Words Wizard Admin
            </h1>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">
              For teachers and administrators.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="mt-7 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[var(--admin-purple)] px-4 text-sm font-bold text-white transition hover:bg-[var(--admin-purple-dark)]"
            >
              <MicrosoftMark />
              Sign in with Microsoft
            </button>
          </>
        )}

        {state === "denied" && (
          <>
            <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--admin-amber-pale)] text-[var(--admin-amber)]">
              <WarningIcon />
            </span>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">
              You don&apos;t have access to the admin portal.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">
              The admin portal is for teachers and administrators. Ask your
              administrator if you think this is a mistake.
            </p>
            {email !== undefined && email !== "" && (
              <p className="my-5 rounded-xl bg-[var(--admin-canvas)] px-3 py-2.5 text-xs font-bold">
                {email}
              </p>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] border border-[var(--admin-line)] bg-white px-4 text-sm font-bold text-[var(--admin-ink)] transition hover:bg-zinc-50"
            >
              Sign out
            </button>
          </>
        )}
      </section>
    </main>
  )
}

function MicrosoftMark(): ReactNode {
  return (
    <span className="grid grid-cols-2 gap-0.5">
      <i className="size-2 bg-white" />
      <i className="size-2 bg-white/80" />
      <i className="size-2 bg-white/80" />
      <i className="size-2 bg-white" />
    </span>
  )
}

function WarningIcon(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={25}
      height={25}
      className="fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]"
    >
      <path d="M12 3 2.8 20h18.4Z" />
      <path d="M12 9v4m0 3h.01" />
    </svg>
  )
}
