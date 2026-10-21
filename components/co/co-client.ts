import { coApi as api, newClientId as newId, pollDelay } from '@/lib/api/co'
import type { CoContextRef, CoContextView, CoConversationView, CoTurnBody, CoTurnView } from './co-types'

/*
 * Browser side of the B10 Ask Co chat. The strict schemas, the answer-key guard, the BFF paths and the id/backoff helpers
 * belong to `lib/api/co.ts` (agent W2); this module only reshapes that client for the panel:
 * - a reply that contradicts the contract (a note without the beyond flag, a partial reply on an unfinished turn, an
 *   answer-key-like field) is refused whole by W2's schemas, so none of it can be shown;
 * - retry answers 202 with a NEW turn (the failed one stays FAILED and is hidden from the transcript once retried), so the new turn is
 *   what the panel shows and polls; cancel answers with the CANCELLED turn;
 * - `coPollDelay` scales W2's backoff (800 ms, 1.2 s, 1.6 s, 2 s ... cap 4 s) so tests can poll quickly.
 */
export const newClientId = newId

/** The backoff of `pollDelay`, scaled by `baseMs / 800` (the production base is 800 ms). */
export function coPollDelay(attempt: number, baseMs = 800): number {
  return Math.max(1, Math.round(pollDelay(attempt) * baseMs / 800))
}

export const coApi = {
  context: (target: CoContextRef): Promise<CoContextView> =>
    target.kind === 'LESSON' ? api.context({ lessonId: target.lessonId, stepIndex: target.stepIndex }) : api.context({ materialId: target.materialId }),
  /** Idempotent get-or-create of the learner's open conversation for the context. */
  conversation: async (context: CoContextRef): Promise<{ id: string }> => (await api.openConversation(context)).conversation,
  history: (conversationId: string): Promise<CoConversationView> => api.conversation(conversationId),
  /** 202 with the turn. The same `clientTurnId` and body always answer with the same turn. */
  send: async (conversationId: string, body: CoTurnBody): Promise<CoTurnView> => (await api.sendTurn(conversationId, body)).turn,
  turn: async (conversationId: string, turnId: string): Promise<CoTurnView> => (await api.turn(conversationId, turnId)).turn,
  /** The NEW turn the platform made from the failed one (idempotent: repeating returns that same new turn). */
  retry: async (conversationId: string, turnId: string): Promise<CoTurnView> => (await api.retryTurn(conversationId, turnId)).turn,
  cancel: async (conversationId: string, turnId: string): Promise<CoTurnView> => (await api.cancelTurn(conversationId, turnId)).turn,
}
