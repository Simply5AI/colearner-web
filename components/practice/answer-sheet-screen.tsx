'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import { bandFromApi, type LearnBand } from '@/lib/api/learn'
import { practiceApi, practiceRoutes } from '@/lib/api/practice'
import { AnswerSheetView } from './answer-sheet'
import { practiceKeys, usePracticeAnswerSheet } from './hub-hooks'

/** The answer sheet page (completed sessions only; the server refuses the rest). "Ask Co to check again" queues one regrade per attempt. */
export function AnswerSheetScreen({ sessionId }: { sessionId: string }) {
  const { actor, band: identityBand } = useLearnIdentity()
  const client = useQueryClient()
  const query = usePracticeAnswerSheet(sessionId)
  const [requested, setRequested] = useState<string[]>([])
  const [regradingId, setRegradingId] = useState<string | null>(null)
  const busy = useRef(false)
  const regrade = useMutation({
    mutationFn: (attemptId: string) => practiceApi.regrade(attemptId), retry: false,
    onSuccess: async (_value, attemptId) => { setRequested(previous => [...previous, attemptId]); await client.invalidateQueries({ queryKey: practiceKeys.sheet(actor, sessionId) }) },
    onSettled: () => { busy.current = false; setRegradingId(null) },
  })
  const fallbackBand: LearnBand = identityBand ?? 'teens'
  if (query.isPending) return <LearnSkeleton band={fallbackBand} label="Opening your answer sheet" rows={2} />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallbackBand} backHref={practiceRoutes.hub} backLabel="Back to practice" />
  const band = query.data.band ? bandFromApi(query.data.band) : fallbackBand
  return <AnswerSheetView sheet={query.data} band={band} requested={requested} regradingId={regradingId} error={regrade.error}
    onRegrade={attemptId => { if (busy.current) return; busy.current = true; setRegradingId(attemptId); regrade.mutate(attemptId) }} />
}
