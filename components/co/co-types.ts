import type { CoContextInfo, CoConversationDetail, CoDisposition, CoReply, CoSource, CoTurnView, SafetyReasonCode, SendTurnBody, TurnStatus } from '@/lib/api/co'

/*
 * B10 Ask Co types. The contract shapes (reply, turn, context) are W2's `lib/api/co.ts`, re-exported here under the names
 * the panel uses, so there is a single definition of what the server may send.
 */
export type { CoDisposition, CoReply, CoSource, CoTurnView, SafetyReasonCode, TurnStatus }
export type CoContextView = CoContextInfo
export type CoConversationView = CoConversationDetail
export type CoTurnBody = SendTurnBody
export type CoStyle = NonNullable<SendTurnBody['style']>

/** What the learner is asking about. The panel opens only for a LESSON or a MATERIAL; HOMEWORK belongs to the homework screens. */
export type CoContextRef = { kind: 'LESSON'; lessonId: string; stepIndex: number | null } | { kind: 'MATERIAL'; materialId: string }

export const isTerminalTurn = (turn: Pick<CoTurnView, 'status'>) => turn.status === 'READY' || turn.status === 'FAILED' || turn.status === 'CANCELLED'
