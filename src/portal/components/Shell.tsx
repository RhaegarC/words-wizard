import type { ReactNode } from "react"

import type { Role } from "../../shared/types"
import { PORTAL_SECTIONS, type PortalSection } from "../router"

import { Brand } from "./Brand"

const LABELS: Record<PortalSection, string> = {
  topics: "Topics",
  words: "Words",
  archived: "Archived",
}

/**
 * The persistent admin frame: sidebar navigation, the live-saves note, and a
 * top bar that names the signed-in staff member and offers Sign out.
 */
export function Shell({
  email,
  role,
  section,
  onNavigate,
  onSignOut,
  children,
}: {
  email: string
  role: Role
  section: PortalSection
  onNavigate: (section: PortalSection) => void
  onSignOut: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--admin-canvas)] text-[var(--admin-ink)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[var(--admin-line)] bg-white px-4 py-5 lg:block">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-8 grid gap-1" aria-label="Admin sections">
          {PORTAL_SECTIONS.map((item) => (
            <SidebarButton
              key={item}
              active={section === item}
              section={item}
              onClick={() => onNavigate(item)}
            />
          ))}
        </nav>
        <div className="absolute inset-x-4 bottom-5 rounded-xl border border-[var(--admin-line)] bg-[var(--admin-canvas)] p-3">
          <p className="text-[10px] font-black tracking-wider text-[var(--admin-muted)] uppercase">
            Changes are live
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--admin-muted)]">
            Anything you save appears for learners immediately.
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--admin-line)] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="lg:hidden">
              <Brand compact />
            </span>
            <span className="hidden text-xs text-[var(--admin-muted)] sm:block">
              Vocabulary workspace
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-[var(--admin-purple-pale)] px-2 py-1 text-[9px] font-black tracking-wider text-[var(--admin-purple)] uppercase">
              {role}
            </span>
            <span className="hidden max-w-[220px] truncate text-xs text-[var(--admin-muted)] sm:block">
              {email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--admin-coral)] hover:bg-[var(--admin-coral-pale)]"
            >
              Sign out
            </button>
          </div>
        </header>

        <nav
          className="flex gap-1 border-b border-[var(--admin-line)] bg-white px-4 py-2 lg:hidden"
          aria-label="Admin sections"
        >
          {PORTAL_SECTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onNavigate(item)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                section === item
                  ? "bg-[var(--admin-purple-pale)] text-[var(--admin-purple)]"
                  : "text-[var(--admin-muted)]"
              }`}
            >
              {LABELS[item]}
            </button>
          ))}
        </nav>

        <main className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function SidebarButton({
  active,
  section,
  onClick,
}: {
  active: boolean
  section: PortalSection
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
        active
          ? "bg-[var(--admin-purple-pale)] text-[var(--admin-purple)]"
          : "text-[var(--admin-muted)] hover:bg-[var(--admin-canvas)] hover:text-[var(--admin-ink)]"
      }`}
    >
      <SectionIcon section={section} />
      <span>{LABELS[section]}</span>
    </button>
  )
}

function SectionIcon({ section }: { section: PortalSection }) {
  const path =
    section === "topics"
      ? "M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v6H3zM14 15h7v6h-7z"
      : section === "words"
        ? "M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22ZM20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22Z"
        : "M4 8v12h16V8M3 4h18v4H3ZM9 12h6"

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      className="shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]"
    >
      <path d={path} />
    </svg>
  )
}
