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
import { progressProvider } from "../db"
import { DEVICE_KEYS } from "../db/device"
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
} from "../domain/session"
import type { Profile, Progress, SessionResult } from "../domain/types"
import { useLocale } from "../i18n/LocaleProvider"
import type { Route } from "../router/routes"
import { useRouter } from "../router/RouterContext"
import {
  listVoices,
  resolveSpeechAvailability,
  speak,
  speechSupported,
} from "../speech"

/**
 * The forward moves the host itself makes while a session runs. Everything
 * else — including back to `#/session` — is an exit and asks for confirmation.
 */
const FORWARD_HASHES: Partial<Record<SessionState["phase"], ReadonlySet<string>>> =
  {
    intro: new Set(["#/session/exercise"]),
    exercise: new Set(["#/session/exercise", "#/session/summary"]),
    feedback: new Set(["#/session/exercise", "#/session/summary"]),
  }

const PHASE_ROUTE: Record<SessionState["phase"], Route> = {
  idle: { id: "session" },
  intro: { id: "session-intro" },
  exercise: { id: "session-exercise" },
  feedback: { id: "session-exercise" },
  complete: { id: "session-summary" },
}

const EMPTY_PLAN: SessionPlan = { words: [], caughtUp: true }
const EMPTY_PREVIEW: SessionPreview = {
  reviewCount: 0,
  newCount: 0,
  caughtUp: true,
}

type SessionContextValue = {
  /** False until the progress read has finished; Start waits for it. */
  ready: boolean
  plan: SessionPlan
  preview: SessionPreview
  state: SessionState
  result: SessionResult | null
  speechAvailable: boolean
  exitOpen: boolean
  dispatch: (action: SessionAction) => void
  start: () => void
  resume: () => void
  confirmExit: () => void
  cancelExit: () => void
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
  children,
}: {
  profile: Profile
  /** The route currently on screen, so a drifted fragment is corrected. */
  route: Route
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
  const [exitOpen, setExitOpen] = useState(false)
  const discarded = useRef(false)
  // The seed fixes the day and content version; a re-render must not reroll it.
  const sessionNow = useRef(Date.now())

  const seed = useMemo(
    () =>
      sessionSeed(
        profile.id ?? -1,
        sessionNow.current,
        "daily",
        getContentMeta().contentVersion,
      ),
    [profile.id],
  )

  const plan = useMemo(() => {
    if (progress === null || profile.id === undefined) {
      return EMPTY_PLAN
    }

    return buildSession({
      profile,
      progress,
      packs: getAllPacks(),
      words: getAllWords(),
      now: sessionNow.current,
      seed,
      speechAvailable,
    })
  }, [progress, profile, seed, speechAvailable])

  const preview = useMemo(() => {
    if (progress === null || profile.id === undefined) {
      return EMPTY_PREVIEW
    }

    return previewSession({
      profile,
      progress,
      packs: getAllPacks(),
      words: getAllWords(),
      now: sessionNow.current,
      seed,
      speechAvailable,
    })
  }, [progress, profile, seed, speechAvailable])

  const [state, setState] = useState<SessionState>(() =>
    createSessionState(EMPTY_PLAN, seed),
  )

  useEffect(() => {
    if (profile.id === undefined) {
      setProgress([])
      return
    }

    let active = true

    progressProvider
      .getAllProgress(profile.id)
      .then((rows) => {
        if (active) {
          setProgress(rows)
        }
      })
      .catch((reason: unknown) => {
        console.error("[session] Could not read progress", reason)

        if (active) {
          setProgress([])
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

    const expected = PHASE_ROUTE[state.phase]

    if (route.id !== expected.id) {
      navigate(expected)
    }
  }, [navigate, route, state.phase])

  useEffect(() => {
    leaveGuard.setBeforeLeave((nextHash) => {
      if (state.phase === "idle" || state.phase === "complete") {
        return true
      }

      if (
        nextHash !== undefined &&
        FORWARD_HASHES[state.phase]?.has(nextHash) === true
      ) {
        return true
      }

      setExitOpen(true)
      return false
    })

    return () => leaveGuard.setBeforeLeave(null)
  }, [leaveGuard, state.phase])

  const start = useCallback(() => {
    discarded.current = false
    setState((current) =>
      sessionReducer(current, { type: "start", now: Date.now() }),
    )
  }, [])

  const resume = useCallback(() => {
    navigate(PHASE_ROUTE[state.phase])
  }, [navigate, state.phase])

  const confirmExit = useCallback(() => {
    // Clear the veto before the navigation that follows, or the confirmation
    // would block the very move it just approved.
    leaveGuard.setBeforeLeave(null)
    discarded.current = true
    setExitOpen(false)
    setState((current) => sessionReducer(current, { type: "abandon" }))
    navigate({ id: "home" })
  }, [leaveGuard, navigate])

  const cancelExit = useCallback(() => setExitOpen(false), [])

  const speakWord = useCallback((text: string) => {
    speak(text)
  }, [])

  const result = useMemo(() => buildSessionResult(state), [state])

  const value = useMemo(
    () => ({
      ready: progress !== null,
      plan,
      preview,
      state,
      result,
      speechAvailable,
      exitOpen,
      dispatch,
      start,
      resume,
      confirmExit,
      cancelExit,
      speakWord,
    }),
    [
      progress,
      plan,
      preview,
      state,
      result,
      speechAvailable,
      exitOpen,
      dispatch,
      start,
      resume,
      confirmExit,
      cancelExit,
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
