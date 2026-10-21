import { z } from 'zod'
import { FamilyError } from './family'

/**
 * B10 widened `GET /family/profiles/:profileId/conversations` response (agent PV). The vendored `FamilyConversationAccess`
 * type (api-client 0.4.0) still says `items: never[]`, so this strict local schema is the only shape the UI renders.
 *
 * Privacy rule (decision D08): a SUMMARIES item can never carry message text. The summary item schema is strict, so a
 * `turns`, `text` or any other unknown key makes the whole response invalid instead of being rendered or ignored.
 * Unknown keys are rejected everywhere (no passthrough); optional fields the platform documents are declared below.
 */
const isoDate = z.iso.datetime({ offset: true })
const count = z.number().int().min(0)
export const conversationKinds = ['CHAT', 'HOMEWORK'] as const
export const homeworkPhases = ['CAPTURE', 'RESTATE', 'STEPS', 'FINAL', 'CHECKED', 'DONE', 'ABANDONED'] as const
export const coDispositions = ['LEARNING', 'CLARIFY', 'SAFE_REDIRECT', 'TRUSTED_ADULT'] as const
export const safetyReasonCodes = ['SELF_HARM', 'ABUSE_DISCLOSURE', 'PERSONAL_INFORMATION', 'EXPLICIT_CONTENT', 'VIOLENCE', 'BULLYING', 'DISTRESS', 'PRIVACY_RISK', 'OFF_TOPIC_UNSAFE', 'OTHER'] as const

const homework = z.strictObject({ phase: z.enum(homeworkPhases), hintsUsed: count })
// The platform sends `reasonCodes` as plain strings (the closed set today). An unknown future code must not blank the whole page,
// so it is read as text and only ever shown through the label map.
const reasonCode = z.string().min(1).max(64)
const turnSafety = z.union([
  z.boolean(),
  z.strictObject({
    redirected: z.boolean(),
    reasonCodes: z.array(reasonCode).max(10).optional(),
    guidance: z.string().max(2000).nullable().optional(),
    classification: z.string().max(64).nullable().optional(),
  }),
])
// A learner entry and the Co entry of the same turn share an `ordinal` (the learner entry comes first). A learner entry has no
// disposition and `beyondMaterial: null`; its `status` says whether Co answered (READY, FAILED, CANCELLED, QUEUED, RUNNING).
const turn = z.strictObject({
  ordinal: z.number().int().min(1),
  role: z.enum(['learner', 'co']),
  text: z.string().max(10000),
  disposition: z.enum(coDispositions).nullable(),
  beyondMaterial: z.boolean().nullable(),
  safety: turnSafety.nullable().optional(),
  status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']).optional(),
})
const baseItem = { id: z.string().min(1).max(100), kind: z.enum(conversationKinds), title: z.string().min(1).max(300), startedAt: isoDate, turnCount: count }
/** `truncated`: the transcript was cut at 200 turns. */
export const fullConversationItem = z.strictObject({ ...baseItem, turns: z.array(turn).max(500), truncated: z.boolean().optional(), homework: homework.nullable().optional(), safetyFlagCount: count.optional() })
export const summaryConversationItem = z.strictObject({ ...baseItem, homework: homework.nullable().optional(), safetyFlagCount: count })
export const safetyAlert = z.strictObject({
  id: z.string().min(1).max(100),
  createdAt: isoDate,
  classification: z.string().min(1).max(64),
  reasonCodes: z.array(reasonCode).max(10),
  conversationId: z.string().min(1).max(100).nullable(),
})
const envelope = {
  profileId: z.string().min(1).max(100),
  /** Absent on pre-B10 platforms, which only ever answered with an empty list. */
  safetyAlerts: z.array(safetyAlert).max(200).default([]),
  nextCursor: z.string().min(1).max(500).nullable(),
  /** Kept by the platform for compatibility; only present with an empty list. */
  reason: z.string().max(100).nullable().optional(),
}
export const familyConversationsSchema = z.discriminatedUnion('access', [
  z.strictObject({ access: z.literal('FULL'), items: z.array(fullConversationItem).max(100), ...envelope }),
  z.strictObject({ access: z.literal('SUMMARIES'), items: z.array(summaryConversationItem).max(100), ...envelope }),
])

export type ConversationTurn = z.infer<typeof turn>
export type FullConversationItem = z.infer<typeof fullConversationItem>
export type SummaryConversationItem = z.infer<typeof summaryConversationItem>
export type FamilySafetyAlert = z.infer<typeof safetyAlert>
export type FamilyConversations = z.infer<typeof familyConversationsSchema>

const invalid = () => new FamilyError(502, 'Conversation records could not be shown because the service sent an unexpected response. Nothing was displayed. Please try again later.', 'CONVERSATIONS_INVALID')

/** Strictly parses a conversations response; any schema violation throws a safe error and renders nothing. */
export function parseFamilyConversations(value: unknown): FamilyConversations {
  const result = familyConversationsSchema.safeParse(value)
  if (!result.success) throw invalid()
  return result.data
}
/**
 * A 14-17 profile without a valid safety grant must only ever get summaries. If the server (or anything in between)
 * returned transcripts anyway, refuse to render them.
 */
export function parseFamilyConversationsFor(value: unknown, options: { teen: boolean; granted: boolean }): FamilyConversations {
  const parsed = parseFamilyConversations(value)
  if (options.teen && !options.granted && parsed.access !== 'SUMMARIES') throw invalid()
  return parsed
}

export const conversationPageSize = 20
export function familyConversationsPath(profileId: string, options: { cursor?: string | null; safetyGrantId?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (options.safetyGrantId) query.set('safetyGrantId', options.safetyGrantId)
  if (options.cursor) query.set('cursor', options.cursor)
  query.set('limit', String(options.limit ?? conversationPageSize))
  return `/family/profiles/${encodeURIComponent(profileId)}/conversations?${query}`
}

export const conversationKindLabel = (kind: (typeof conversationKinds)[number]) => kind === 'HOMEWORK' ? 'Homework help' : 'Ask Co'
export const homeworkPhaseLabel: Record<(typeof homeworkPhases)[number], string> = {
  CAPTURE: 'Entering the problem', RESTATE: 'Checking the problem', STEPS: 'Working through steps', FINAL: 'Typing a final answer',
  CHECKED: 'Final answer checked', DONE: 'Finished', ABANDONED: 'Stopped early',
}
export const dispositionLabel: Record<(typeof coDispositions)[number], string> = {
  LEARNING: 'Learning answer', CLARIFY: 'Co asked a question', SAFE_REDIRECT: 'Safety redirect', TRUSTED_ADULT: 'Suggested a trusted adult',
}
// The platform stores the classification in capitals (CONTENT_RISK, DISTRESS, PRIVACY_RISK, HUMAN_REVIEW); matching ignores case.
const classificationLabels: Record<string, string> = {
  content_risk: 'Unsafe content', distress: 'Possible distress', privacy_risk: 'Personal information', human_review: 'Needs a person to review',
  safe_redirect: 'Safety redirect', trusted_adult: 'Trusted adult suggested',
}
export const safetyClassificationLabel = (classification: string) => classificationLabels[classification.toLowerCase()] ?? 'Safety check'
/** Whether a transcript turn carries a safety marker (redirected or a non-learning safety disposition). */
/** React key of a transcript entry: the learner entry and the Co entry of one turn share the ordinal. */
export const turnKey = (turn: Pick<ConversationTurn, 'ordinal' | 'role'>) => `${turn.ordinal}-${turn.role}`
export function turnHasSafetyMarker(turn: ConversationTurn) {
  const safety = turn.safety
  return turn.disposition === 'SAFE_REDIRECT' || turn.disposition === 'TRUSTED_ADULT' || safety === true || (typeof safety === 'object' && safety !== null && safety.redirected)
}
export function flagCount(item: FullConversationItem | SummaryConversationItem) {
  if ('turns' in item) return item.safetyFlagCount ?? item.turns.filter(turnHasSafetyMarker).length
  return item.safetyFlagCount
}
