'use client'

import { useEffect, useState } from 'react'
import { getAttemptDiagnosis } from '@/lib/api/recall'
import type { ReadyDiagnosis } from '@/lib/types'

const POLL_INTERVAL_MS = 2_000
const MAX_POLL_MS = 15_000

export function useAttemptDiagnosis(
  authHeaders: Record<string, string>,
  attemptId: string | undefined,
  enabled: boolean,
): ReadyDiagnosis | null {
  const [diagnosis, setDiagnosis] = useState<ReadyDiagnosis | null>(null)

  useEffect(() => {
    setDiagnosis(null)
    if (!enabled || !attemptId) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()
    const startedAt = Date.now()

    async function poll() {
      if (cancelled) return
      if (Date.now() - startedAt > MAX_POLL_MS) return

      try {
        const result = await getAttemptDiagnosis(authHeaders, attemptId!, controller.signal)
        if (cancelled) return
        if (result.ready) {
          setDiagnosis(result)
          return
        }
      } catch {
        return
      }

      if (!cancelled && Date.now() - startedAt < MAX_POLL_MS) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      controller.abort()
    }
  }, [authHeaders, attemptId, enabled])

  return diagnosis
}
