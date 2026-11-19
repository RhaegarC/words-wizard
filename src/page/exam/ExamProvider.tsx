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

import type { BadgeFacts } from "@shared/badges"
import { factsAfterExamCompletion, newlyEarned } from "@shared/badges"
import type { ExamResult, ExamSubmission, TopicExam } from "@shared/exam"
import type { Profile } from "@shared/types"

import { readBadgeFacts } from "../api/badgeFacts"
import { ApiError } from "../api/client"
import { progressProvider } from "../api/provider"

/**
 * Feature 35. One topic exam's server state, shared by the landing, part and
 * summary screens. The exam owns no local accounting: every outcome comes back
 * from the Worker, and the state is re-read after each submission.
 */

export type ExamError = "no-topic" | "load" | "submit" | "stale"

export interface ExamContextValue {
  readonly topicId: string | null
  readonly ready: boolean
  readonly exam: TopicExam | null
  readonly error: ExamError | null
  readonly result: ExamResult | null
  readonly submitting: boolean
  /** The topic trophy this submission just completed, if any. */
  readonly newBadges: readonly string[]
  reload: () => Promise<void>
  submit: (submission: ExamSubmission) => Promise<ExamResult | null>
  clearResult: () => void
}

const ExamContext = createContext<ExamContextValue | null>(null)

export function ExamProvider({
  profile,
  children,
}: {
  profile: Profile
  children: ReactNode
}) {
  const topicId = profile.currentTopicId
  const [exam, setExam] = useState<TopicExam | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<ExamError | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [newBadges, setNewBadges] = useState<readonly string[]>([])
  // The shelf as it was when the exam opened. An exam changes only topic
  // completion, so this is the whole "before" the summary strip needs.
  const factsBefore = useRef<Promise<BadgeFacts | null> | null>(null)

  useEffect(() => {
    factsBefore.current = readBadgeFacts(profile).catch((reason: unknown) => {
      console.warn("[exam] Could not read badge facts", reason)
      return null
    })
  }, [profile])

  const reload = useCallback(async (): Promise<void> => {
    if (topicId === null) {
      setExam(null)
      setError("no-topic")
      setReady(true)
      return
    }

    try {
      setExam(await progressProvider.getExam(topicId))
      setError(null)
    } catch (caught: unknown) {
      console.error("[exam] Could not load the exam", caught)
      setError("load")
    } finally {
      setReady(true)
    }
  }, [topicId])

  useEffect(() => {
    setReady(false)
    void reload()
  }, [reload])

  const submit = useCallback(
    async (submission: ExamSubmission): Promise<ExamResult | null> => {
      setSubmitting(true)
      setResult(null)
      setNewBadges([])

      try {
        const next = await progressProvider.submitExam(submission)

        setResult(next)
        await reload()

        if (topicId !== null && next.state.completedAt !== null) {
          const before = await factsBefore.current

          if (before !== null) {
            setNewBadges(
              newlyEarned(
                before,
                factsAfterExamCompletion(
                  before,
                  topicId,
                  next.state.completedAt,
                ),
              ),
            )
          }
        }

        return next
      } catch (caught: unknown) {
        console.error("[exam] Could not submit the part", caught)

        if (caught instanceof ApiError && caught.code === "exam_stale") {
          setError("stale")
          await reload()
        } else {
          setError("submit")
        }

        return null
      } finally {
        setSubmitting(false)
      }
    },
    [reload, topicId],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setNewBadges([])
  }, [])

  const value = useMemo(
    () => ({
      topicId,
      ready,
      exam,
      error,
      result,
      submitting,
      newBadges,
      reload,
      submit,
      clearResult,
    }),
    [
      topicId,
      ready,
      exam,
      error,
      result,
      submitting,
      newBadges,
      reload,
      submit,
      clearResult,
    ],
  )

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>
}

export function useExam(): ExamContextValue {
  const value = useContext(ExamContext)

  if (!value) {
    throw new Error("useExam must be used inside ExamProvider")
  }

  return value
}
