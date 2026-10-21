import { z } from 'zod'
import { learnRequest } from './learn-request'

/*
 * B03 resume contract (platform <-> web), 19 October 2026: GET /learn/link-status.
 * Until the portable @colearner/api-client carries the matching type, these local
 * interfaces mirror the contract and the Zod schema below must `satisfies` them.
 * The response is deliberately minimal: it never carries emails, guardian names,
 * profile or user ids, so the schema is strict and rejects any extra field.
 */
export type LinkStage =
  | 'READY'
  | 'NEEDS_ROSTER_LINK'
  | 'NEEDS_GUARDIAN'
  | 'NEEDS_GUARDIAN_CONSENT'
  | 'PROFILE_NOT_BOUND'
  | 'CONSENT_WITHDRAWN'
  | 'AGE_OUT_OF_SCOPE'
  | 'SCHOOL_INACTIVE'
export type LinkWaitingOn = 'NONE' | 'SCHOOL' | 'GUARDIAN' | 'STUDENT'
export interface LearnerLinkStatus {
  stage: LinkStage
  /** True only for READY. */
  canLearn: boolean
  school: { name: string } | null
  waitingOn: LinkWaitingOn
  /** Teens only. `pending: true` means the student can accept at /student-invite. */
  studentLoginInvitation: { pending: boolean; expiresAt: string | null } | null
  checkedAt: string
}

export const linkStages = ['READY', 'NEEDS_ROSTER_LINK', 'NEEDS_GUARDIAN', 'NEEDS_GUARDIAN_CONSENT', 'PROFILE_NOT_BOUND', 'CONSENT_WITHDRAWN', 'AGE_OUT_OF_SCOPE', 'SCHOOL_INACTIVE'] as const satisfies readonly LinkStage[]

const stage = z.enum(linkStages)
export const learnerLinkStatusSchema = z.object({
  stage,
  canLearn: z.boolean(),
  school: z.object({ name: z.string().min(1).max(200) }).strict().nullable(),
  waitingOn: z.enum(['NONE', 'SCHOOL', 'GUARDIAN', 'STUDENT']),
  studentLoginInvitation: z.object({ pending: z.boolean(), expiresAt: z.string().min(1).nullable() }).strict().nullable(),
  checkedAt: z.string().min(1),
}).strict().refine(value => value.canLearn === (value.stage === 'READY'), { message: 'canLearn must be true only for READY' }) satisfies z.ZodType<LearnerLinkStatus>

export const learnLinkApi = {
  /** Read-only. The student can never bind themselves; this only explains what the school or a grown-up must do. */
  status: () => learnRequest('/link-status', learnerLinkStatusSchema),
}

/** Denial codes whose error state should offer "See what's needed". */
export const linkHelpCodes = ['CHILD_PROFILE_REQUIRED', 'CONSENT_REQUIRED'] as const
export const linkHelpHref = '/learn/link'
/** True for a learn, onboarding or material error that carries one of the link-related denial codes. */
export function needsLinkHelp(error: unknown): boolean {
  const code = error !== null && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' && (linkHelpCodes as readonly string[]).includes(code)
}
