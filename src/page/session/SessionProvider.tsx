import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  getAllPacks,
  getAllWords,
  getContentMeta,
} from "../content"
import { progressProvider } from "../api/provider"
import type { PackIntroduction } from "@shared/me"
import { DEVICE_KEYS } from "@shared/device"
import { checkProfileAfterSession } from "../db/lifecycle"
import { METRIC_NAMES } from "@shared/metrics"
import { buildReview, isMonthlyReviewDue } from "@shared/monthlyReview"
import {
  buildSessionCommit,
  type SessionSummary,
} from "@shared/progression"
import {
  buildSession,
  buildSessionResult,
  createSessionState,
  previewSession,
  sessionReducer,
  sessionSeed,
  type SessionAction,
  type SessionPlan,
  type SessionPreview,
  type SessionState,
} from "@shared/session"
import type {
  Profile,
  Progress,
  SessionKind,
  SessionResult,
} from "@shared/types"
import { useLocale } from "../i18n/LocaleProvider"
import { buildHash, type Route } from "../router/routes"
import { useRouter } from "../router/RouterContext"
import {
  listVoices,
  resolveSpeechAvailability,
  speak,
  speechSupported,
} from "../speech"

import { commitSessionResult } from "./commit"

/**
 * The forward moves the host itself makes while a session runs. Everything
 * else — including back to the landing — is an exit and asks for confirmation.
 */
function forwardHashes(
  kind: SessionKind,
): Partial<Record<SessionState["phase"], ReadonlySet<string>>> {
  const exercise = buildHash(
    kind === "monthly" ? { id: "review-exercise" } : { id: "session-exercise" },
  )
  const summary = buildHash(
    kind === "monthly" ? { id: "review-summary" } : { id: "session-summary" },
  )

  return {
    intro: new Set([exercise]),
    exercise: new Set([exercise, summary]),
    feedback: new Set([exercise, summary]),
  }
}

function phaseRoutes(kind: SessionKind): Record<SessionState["phase"], Route> {
  return kind === "monthly"
    ? {
        idle: { id: "review" },
        // A review has no intro card; the idle phase never visits this.
        intro: { id: "review" },
        exercise: { id: "review-exercise" },
        feedback: { id: "review-exercise" },
        complete: { id: "review-summary" },
      }
    : {
        idle: { id: "session" },
        intro: { id: "session-intro" },
        exercise: { id: "session-exercise" },
        feedback: { id: "session-exercise" },
        complete: { id: "session-summary" },
      }
}

function isReviewRoute(route: Route): boolean {
  return (
    route.id === "review" ||
    route.id === "review-exercise" ||
    route.id === "review-summary"
  )
}

const EMPTY_PLAN: SessionPlan = {
  words: [],
  caughtUp: true,
  introductions: [],
}
const EMPTY_PREVIEW: SessionPreview = {
  reviewCount: 0,
  newCount: 0,
  repeatCount: 0,
  caughtUp: true,
}

export type CommitStatus = "idle" | "saving" | "done" | "queued" | "error"

type CommitState = {
  status: CommitStatus
  summary: SessionSummary | null
}

type SessionContextValue = {
  /** False until the progress read has finished; Start waits for it. */
  ready: boolean
  kind: SessionKind
  /** True only for a monthly host whose review is due right now. */
  reviewDue: boolean
  plan: SessionPlan
  preview: SessionPreview
  state: SessionState
  result: SessionResult | null
  speechAvailable: boolean
  exitOpen: boolean
  commitStatus: CommitStatus
  summary: SessionSummary | null
  dispatch: (action: SessionAction) => void
  start: () => void
  resume: () => void
  confirmExit: () => void
  cancelExit: () => void
  retryCommit: () => void
  speakWord: (text: string) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

/**
 * Owns one session's state for as long as the child stays in the session
 * routes. Nothing is written: the completed `SessionResult` is handed to
 * `#/session/summary`, where feature 09 commits it.
 */
export function SessionProvider({
  profile,
  route,
  onProfileUpdated,
  onProfileLost,
  children,
}: {
  profile: Profile
  /** The route currently on screen, so a drifted fragment is corrected. */
  route: Route
  /** Lets the boot snapshot follow the committed profile without a reload. */
  onProfileUpdated?: (profile: Profile) => void
  /** PRD §8.4: the profile vanished between the commit and the re-read. */
  onProfileLost?: () => void
  children: ReactNode
}) {
  const { t } = useLocale()
  const { navigate, leaveGuard } = useRouter()
  const liveSpeech = useSpeechAvailability()
  const [recordedSpeech, setRecordedSpeech] = useState<boolean | null>(null)
  // Until the live voice list has actually loaded, trust the boot record (it
  // is the stored `device.speechAvailable`). A loaded list is authoritative,
  // so a voice that arrives late can re-enable listening for a new session.
  const speechAvailable = liveSpeech.loaded
    ? liveSpeech.available
    : (recordedSpeech ?? liveSpeech.available)
  const [progress, setProgress] = useState<readonly Progress[] | null>(null)
  const [introductions, setIntroductions] = useState<
    readonly PackIntroduction[] | null
  >(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [commit, setCommit] = useState<CommitState>({
    status: "idle",
    summary: null,
  })
  const discarded = useRef(false)
  // The in-memory half of the double-submit guard: the first commit wins,
  // and a failed one clears the id so the retry button can try again.
  const commitStarted = useRef<string | null>(null)
  // The seed fixes the day and content version; a re-render must not reroll it.
  const sessionNow = useRef(Date.now())
  const kind: SessionKind = isReviewRoute(route) ? "monthly" : "daily"
  const routes = useMemo(() => phaseRoutes(kind), [kind])
  const reviewDue =
    progress !== null &&
    isMonthlyReviewDue(profile, progress, sessionNow.current)

  const seed = useMemo(
    () =>
      sessionSeed(
        profile.id,
        sessionNow.current,
        kind,
        getContentMeta().contentVersion,
      ),
    [kind, profile.id],
  )

  const plan = useMemo(() => {
    if (progress === null || introductions === null) {
      return EMPTY_PLAN
    }

    if (kind === "monthly") {
      return isMonthlyReviewDue(profile, progress, sessionNow.current)
        ? buildReview({
            profile,
            progress,
            words: getAllWords(),
            now: sessionNow.current,
            seed,
            speechAvailable,
          })
        : EMPTY_PLAN
    }

    return buildSession({
      profile,
      progress,
      packs: getAllPacks(),
      words: getAllWords(),
      now: sessionNow.current,
      seed,
      speechAvailable,
      introductions,
    })
  }, [introductions, kind, progress, profile, seed, speechAvailable])

  const preview = useMemo(() => {
    if (progress === null || introductions === null) {
      return EMPTY_PREVIEW
    }

    if (kind === "monthly") {
      return {
        reviewCount: plan.words.length,
        newCount: 0,
        repeatCount: 0,
        caughtUp: plan.words.length === 0,
      }
    }

    return previewSession({
      profile,
      progress,
      packs: getAllPacks(),
      words: getAllWords(),
      now: sessionNow.current,
      seed,
      speechAvailable,
      introductions,
    })
  }, [
    introductions,
    kind,
    plan.words.length,
    progress,
    profile,
    seed,
    speechAvailable,
  ])

  const [state, setState] = useState<SessionState>(() =>
    createSessionState(EMPTY_PLAN, seed),
  )

  useEffect(() => {
    let active = true

    // Progress and introductions decide the plan together: the first keeps
    // review scheduling, the second decides which pack is unlocked.
    void Promise.all([
      progressProvider.getAllProgress(profile.id),
      progressProvider.getIntroductions(profile.id),
    ])
      .then(([rows, introRows]) => {
        if (active) {
          setProgress(rows)
          setIntroductions(introRows)
        }
      })
      .catch((reason: unknown) => {
        console.error("[session] Could not read progress", reason)

        if (active) {
          setProgress([])
          setIntroductions([])
        }
      })

    return () => {
      active = false
    }
  }, [profile.id])

  // The session builder reads the boot-time voice record, not just the live
  // list, so a device whose voices arrived late is still handled consistently.
  useEffect(() => {
    let active = true

    progressProvider
      .getDevice(DEVICE_KEYS.speechAvailable)
      .then((value) => {
        if (active) {
          setRecordedSpeech(typeof value === "boolean" ? value : null)
        }
      })
      .catch(() => {
        if (active) {
          setRecordedSpeech(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  // The plan arrives after the progress read, and again if voice support
  // changes before the child starts. An active session keeps its plan.
  useEffect(() => {
    setState((current) =>
      current.phase === "idle" ? createSessionState(plan, seed) : current,
    )
  }, [plan, seed])

  const dispatch = useCallback((action: SessionAction) => {
    setState((current) => sessionReducer(current, action))
  }, [])

  // The fragment follows the phase, so back/forward and a reload never show a
  // screen the session is not on. `discarded` stops an abandoned session from
  // being pulled back to `#/session` while the router leaves the family.
  useEffect(() => {
    // Once abandoned, the router is already on its way out; do not pull it
    // back to `#/session` for the one render before the provider unmounts.
    if (state.phase === "idle" && discarded.current) {
      return
    }

    const expected = routes[state.phase]

    if (route.id !== expected.id) {
      navigate(expected)
    }
  }, [navigate, route, routes, state.phase])

  useEffect(() => {
    const forward = forwardHashes(kind)
    const ownFamily =
      kind === "monthly"
        ? [buildHash({ id: "review" }), buildHash({ id: "review-exercise" })]
        : [
            buildHash({ id: "session" }),
            buildHash({ id: "session-intro" }),
            buildHash({ id: "session-exercise" }),
          ]

    leaveGuard.setBeforeLeave((nextHash) => {
      if (state.phase === "idle") {
        return true
      }

      if (state.phase === "complete") {
        // Do not let the child leave while the transaction is open: a failure
        // reported after unmount would be silent and unretryable.
        if (commit.status === "saving") {
          return false
        }

        // A completed session may leave for anywhere but back into its own
        // exercise screens; the summary is the only session view left.
        return !(nextHash !== undefined && ownFamily.includes(nextHash))
      }

      if (
        nextHash !== undefined &&
        forward[state.phase]?.has(nextHash) === true
      ) {
        return true
      }

      setExitOpen(true)
      return false
    })

    return () => leaveGuard.setBeforeLeave(null)
  }, [commit.status, kind, leaveGuard, state.phase])

  const start = useCallback(() => {
    discarded.current = false
    setState((current) =>
      sessionReducer(current, { type: "start", now: Date.now() }),
    )
  }, [])

  const resume = useCallback(() => {
    navigate(routes[state.phase])
  }, [navigate, routes, state.phase])

  const confirmExit = useCallback(() => {
    // Clear the veto before the navigation that follows, or the confirmation
    // would block the very move it just approved.
    leaveGuard.setBeforeLeave(null)
    discarded.current = true
    setExitOpen(false)

    // An abandoned session commits no progress; only its counter moves.
    if (state.phase !== "idle") {
      void progressProvider
        .incrementMetric(profile.id, METRIC_NAMES.sessionAbandoned)
        .catch((reason: unknown) => {
          console.warn("[session] Could not record the abandon", reason)
        })
    }

    setState((current) => sessionReducer(current, { type: "abandon" }))
    navigate({ id: "home" })
  }, [leaveGuard, navigate, profile.id, state.phase])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const speakWord = useCallback((text: string) => {
    speak(text)
  }, [])

  const result = useMemo(() => buildSessionResult(state), [state])

  /**
   * One commit per completed session. The ref stops a second submit in the
   * same render; the guard inside `commitSessionResult` stops a second one
   * while the transaction is still open.
   */
  const runCommit = useCallback(() => {
    if (result === null || progress === null) {
      return
    }

    if (commitStarted.current === result.id) {
      return
    }

    commitStarted.current = result.id

    const built = buildSessionCommit(result, profile, progress, Date.now(), {
      contentVersion: getContentMeta().contentVersion,
      introductions: plan.introductions,
    })

    setCommit({ status: "saving", summary: built.summary })

    void commitSessionResult(progressProvider, result.id, built.payload)
      .then((outcome) => {
        // A null outcome means the guard already sent this session.
        if (outcome === null) {
          return
        }

        setCommit({
          status: outcome === "queued" ? "queued" : "done",
          summary: built.summary,
        })

        // A queued commit is not on the server yet, so there is nothing fresh
        // to read back; the outbox replays it on the next boot.
        if (outcome === "queued") {
          return
        }

        // Feature 05's post-session check: the boot snapshot is stale, and a
        // missing profile must take the recovery path rather than keep a
        // summary over a record that no longer exists.
        void checkProfileAfterSession(progressProvider)
          .then((check) => {
            if (check.status === "present") {
              onProfileUpdated?.(check.profile)
            } else {
              onProfileLost?.()
            }
          })
          .catch((reason: unknown) => {
            console.warn("[session] Could not re-read the profile", reason)
          })
      })
      .catch((reason: unknown) => {
        console.error("[session] Could not save this session", reason)
        commitStarted.current = null
        setCommit({ status: "error", summary: built.summary })
      })
  }, [onProfileLost, onProfileUpdated, plan.introductions, profile, progress, result])

  // The summary route is what completes the loop, so reaching it commits.
  useEffect(() => {
    if (state.phase === "complete") {
      runCommit()
    }
  }, [runCommit, state.phase])

  const value = useMemo(
    () => ({
      ready: progress !== null && introductions !== null,
      kind,
      reviewDue,
      plan,
      preview,
      state,
      result,
      speechAvailable,
      exitOpen,
      commitStatus: commit.status,
      summary: commit.summary,
      dispatch,
      start,
      resume,
      confirmExit,
      cancelExit,
      retryCommit: runCommit,
      speakWord,
    }),
    [
      progress,
      introductions,
      kind,
      reviewDue,
      plan,
      preview,
      state,
      result,
      speechAvailable,
      exitOpen,
      commit,
      dispatch,
      start,
      resume,
      confirmExit,
      cancelExit,
      runCommit,
      speakWord,
    ],
  )

  return (
    <SessionContext.Provider value={value}>
      {children}

      {exitOpen ? (
        <div
          className="modal-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              cancelExit()
            }
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-exit-title"
          >
            <h2 id="session-exit-title" className="modal-title">
              {t("session.exitTitle")}
            </h2>
            <p className="modal-body">{t("session.exitBody")}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelExit}
                autoFocus
              >
                {t("session.exitCancel")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={confirmExit}
              >
                {t("session.exitConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)

  if (!value) {
    throw new Error("useSession must be used inside SessionProvider")
  }

  return value
}

type LiveSpeech = {
  available: boolean
  /** False while the browser has not produced any voices yet (iOS Safari). */
  loaded: boolean
}

/**
 * Voices may arrive after mount (iOS Safari), so the flag is refreshed on
 * `voiceschanged`. A loaded list with no English voice disables listening.
 */
function useSpeechAvailability(): LiveSpeech {
  const read = (): LiveSpeech => {
    const voices = listVoices()

    return {
      available: resolveSpeechAvailability(speechSupported(), voices),
      loaded: voices.length > 0,
    }
  }

  const [speech, setSpeech] = useState<LiveSpeech>(read)

  useEffect(() => {
    if (!speechSupported()) {
      return
    }

    const update = () => setSpeech(read())

    update()
    window.speechSynthesis.addEventListener("voiceschanged", update)

    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", update)
  }, [])

  return speech
}
