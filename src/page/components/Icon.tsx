import type { ReactNode } from "react"

export type IconName =
  | "home"
  | "book"
  | "sparkle"
  | "user"
  | "flame"
  | "heart"
  | "play"
  | "volume"
  | "arrow"
  | "check"
  | "settings"
  | "globe"
  | "download"
  | "shield"
  | "chart"
  | "close"
  | "moon"
  | "image"
  | "search"

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22Z" />
      <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22Z" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" />
    </>
  ),
  flame: (
    <path d="M13.5 22c4-1 6.5-3.7 6.5-7.5 0-2.9-1.6-5.5-4.4-7.7.1 2.6-1.2 4.3-2.4 5.2.2-4-2.1-7.1-5.3-9.5.3 4.5-3.9 7.1-3.9 12 0 3.8 2.5 6.5 6.5 7.5-1.5-.9-2.4-2.4-2.4-4.1 0-1.9 1.2-3.5 3-4.8-.1 2 .7 3 1.5 3.7.5-.8 1-1.8.9-3.1 1.5 1.1 2.4 2.5 2.4 4.2 0 1.7-.9 3.2-2.4 4.1Z" />
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  play: <path d="m9 6 9 6-9 6Z" />,
  volume: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M5 20h14" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  moon: <path d="M20 15.3A9 9 0 0 1 8.7 4a9 9 0 1 0 11.3 11.3Z" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 15-5-5L5 20" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
}

/** One inline SVG set, so the app draws its own icons with no font or network. */
export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={["icon", className].filter(Boolean).join(" ")}
      viewBox="0 0 24 24"
      width={size}
      height={size}
    >
      {PATHS[name]}
    </svg>
  )
}
