import { useEffect, useState } from "react"

import type { TopicExamState } from "@shared/exam"
import type { PackIntroduction } from "@shared/me"

import { progressProvider } from "../api/provider"

/** The status inputs the topic picker needs, read once per profile. */
export interface TopicStatusData {
  /** `null` while the first read is in flight. */
  introductions: readonly PackIntroduction[] | null
  /** `null` while the first read is in flight. */
  exams: readonly TopicExamState[] | null
  failed: boolean
}

export interface IntroductionsData {
  /** `null` while the first read is in flight. */
  introductions: readonly PackIntroduction[] | null
  failed: boolean
}

/** A profile's introduction rows; the hub uses this to derive its status. */
export function useIntroductions(profileId: string): IntroductionsData {
  const [introductions, setIntroductions] = useState<
    readonly PackIntroduction[] | null
  >(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    setIntroductions(null)
    setFailed(false)

    void progressProvider
      .getIntroductions(profileId)
      .then((rows) => {
        if (active) {
          setIntroductions(rows)
        }
      })
      .catch((error: unknown) => {
        console.error("[topics] Could not read introductions", error)

        if (active) {
          setFailed(true)
          setIntroductions([])
        }
      })

    return () => {
      active = false
    }
  }, [profileId])

  return { introductions, failed }
}

function useExams(profileId: string): {
  exams: readonly TopicExamState[] | null
  failed: boolean
} {
  const [exams, setExams] = useState<readonly TopicExamState[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    setExams(null)
    setFailed(false)

    void progressProvider
      .getExams()
      .then((rows) => {
        if (active) {
          setExams(rows)
        }
      })
      .catch((error: unknown) => {
        console.error("[topics] Could not read exam states", error)

        if (active) {
          setFailed(true)
          setExams([])
        }
      })

    return () => {
      active = false
    }
  }, [profileId])

  return { exams, failed }
}

/** Introductions plus exam states, the two inputs every topic badge needs. */
export function useTopicStatus(profileId: string): TopicStatusData {
  const introductions = useIntroductions(profileId)
  const exams = useExams(profileId)

  return {
    introductions: introductions.introductions,
    exams: exams.exams,
    failed: introductions.failed || exams.failed,
  }
}
