'use client'
import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApprovalsError, IntentKeys, fetchApproval, fetchApprovalSummary, fetchApprovals, submitDecision, submitRevoke,
  type ApprovalIntent, type ApprovalListState, type ApprovalRequest,
} from '@/lib/api/family-approvals'

export const approvalsKey = ['family-approvals'] as const
const noRetry = { retry: false, refetchOnWindowFocus: false } as const

export const useApprovalList = (state: ApprovalListState) => useQuery({ queryKey: [...approvalsKey, 'list', state], queryFn: () => fetchApprovals(state), ...noRetry })
export const useApprovalDetail = (id: string) => useQuery({ queryKey: [...approvalsKey, 'detail', id], queryFn: () => fetchApproval(id), ...noRetry })
export const useApprovalSummary = () => useQuery({ queryKey: [...approvalsKey, 'summary'], queryFn: fetchApprovalSummary, ...noRetry })

export interface DecisionOutcome {
  intent: ApprovalIntent
  request: ApprovalRequest
  /** True when the server reported that this guardian's own earlier press (same key) or another guardian already decided. */
  replayed: boolean
  /** The request was already decided before this press (409 ALREADY_DECIDED). */
  alreadyDecided: boolean
}

/**
 * Sends one decision. The Idempotency-Key is created once per (request, intent) and reused for every retry of that intent
 * after a network or server failure, so a retry can never decide twice. The key is dropped only after the server answers
 * definitively (success or a 4xx), so a later deliberate action is a fresh intent.
 */
export function useDecision() {
  const client = useQueryClient()
  const keys = useRef(new IntentKeys())
  return useMutation<DecisionOutcome, ApprovalsError, { id: string; intent: ApprovalIntent }>({
    retry: false,
    mutationFn: async ({ id, intent }) => {
      const key = keys.current.keyFor(id, intent)
      try {
        const result = intent === 'REVOKE' ? await submitRevoke(id, key) : await submitDecision(id, intent, key)
        keys.current.release(id, intent)
        return { intent, request: result.request, replayed: !result.changed, alreadyDecided: false }
      } catch (error) {
        if (error instanceof ApprovalsError && error.status >= 400 && error.status < 500) {
          keys.current.release(id, intent)
          if (error.code === 'ALREADY_DECIDED' && error.request) return { intent, request: error.request, replayed: false, alreadyDecided: true }
        }
        throw error
      }
    },
    // A refused decision keeps its dialog open to explain why; the lists refresh when that dialog closes.
    onSuccess: () => { void client.invalidateQueries({ queryKey: approvalsKey }) },
  })
}
