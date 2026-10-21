/*
 * SYNTHETIC FIXTURES. Imported only by the development harness (app/dev/learn-link), the Playwright
 * review and tests. Nothing here is a real learner, school or guardian, and none of it is rendered by a production route.
 */
import { linkStages, type LearnerLinkStatus, type LinkStage, type LinkWaitingOn } from '@/lib/api/learn-link'

export { linkStages }
const checkedAt = '2026-10-19T09:30:00Z'
const school = { name: 'Greenfield School' }
const waiting: Record<LinkStage, LinkWaitingOn> = {
  READY: 'NONE', NEEDS_ROSTER_LINK: 'SCHOOL', NEEDS_GUARDIAN: 'SCHOOL', NEEDS_GUARDIAN_CONSENT: 'GUARDIAN',
  PROFILE_NOT_BOUND: 'SCHOOL', CONSENT_WITHDRAWN: 'GUARDIAN', AGE_OUT_OF_SCOPE: 'NONE', SCHOOL_INACTIVE: 'SCHOOL',
}

export function linkStatusFixture(stage: LinkStage = 'NEEDS_ROSTER_LINK', extra: Partial<LearnerLinkStatus> = {}): LearnerLinkStatus {
  return { stage, canLearn: stage === 'READY', school, waitingOn: waiting[stage], studentLoginInvitation: null, checkedAt, ...extra }
}
/** A teen whose parent has asked for a student login that the teen can accept at /student-invite. */
export const pendingInvitationFixture = (): LearnerLinkStatus => linkStatusFixture('NEEDS_GUARDIAN_CONSENT', { waitingOn: 'STUDENT', studentLoginInvitation: { pending: true, expiresAt: '2026-10-26T09:30:00Z' } })

export type LinkHarnessState = 'default' | 'invitation' | 'loading' | 'denied' | 'unavailable' | 'session-ended'
export const linkHarnessStates: readonly LinkHarnessState[] = ['default', 'invitation', 'loading', 'denied', 'unavailable', 'session-ended']
