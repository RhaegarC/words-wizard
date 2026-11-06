/** The portal wordmark, matching the child app's tile treatment. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[12px_12px_12px_4px] bg-[var(--admin-purple)] text-white shadow-sm">
        <span className="text-lg leading-none">W</span>
      </span>
      {!compact && (
        <span className="text-[17px] font-extrabold tracking-[-0.03em] text-[var(--admin-ink)]">
          Words <b className="text-[var(--admin-purple)]">Wizard</b>
          <small className="ml-2 rounded-md bg-[var(--admin-purple-pale)] px-1.5 py-1 align-middle text-[9px] font-black tracking-wider text-[var(--admin-purple)] uppercase">
            Admin
          </small>
        </span>
      )}
    </div>
  )
}
