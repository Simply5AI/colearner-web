import { seedEnrollments, seedInviteCodes, type TeacherEnrollment, type TeacherInviteCode } from '@/lib/fixtures/teacher-enrollments'

type EnrollmentsGlobal = typeof globalThis & {
  __teacherEnrollmentsStore?: TeacherEnrollment[]
  __teacherInviteCodesStore?: TeacherInviteCode[]
}

function getEnrollmentsStore(): TeacherEnrollment[] {
  const globalStore = globalThis as EnrollmentsGlobal
  if (!globalStore.__teacherEnrollmentsStore) {
    globalStore.__teacherEnrollmentsStore = structuredClone(seedEnrollments)
  }
  return globalStore.__teacherEnrollmentsStore!
}

function getInviteCodesStore(): TeacherInviteCode[] {
  const globalStore = globalThis as EnrollmentsGlobal
  if (!globalStore.__teacherInviteCodesStore) {
    globalStore.__teacherInviteCodesStore = structuredClone(seedInviteCodes)
  }
  return globalStore.__teacherInviteCodesStore!
}

export function listPlanEnrollments(planId: string): TeacherEnrollment[] {
  return getEnrollmentsStore()
    .filter((entry) => entry.planId === planId)
    .map((entry) => structuredClone(entry))
}

export function listPlanInviteCodes(planId: string): TeacherInviteCode[] {
  return getInviteCodesStore()
    .filter((entry) => entry.planId === planId && !entry.revokedAt)
    .map((entry) => structuredClone(entry))
}

export function createInviteCode(input: {
  planId: string
  maxUses: number
  expiresAt: string | null
  createdBy: string
}): TeacherInviteCode {
  const code = `PLAN-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
  const invite: TeacherInviteCode = {
    id: `inv-${crypto.randomUUID().slice(0, 8)}`,
    planId: input.planId,
    code,
    maxUses: input.maxUses,
    usedCount: 0,
    expiresAt: input.expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    revokedAt: null,
  }
  getInviteCodesStore().unshift(invite)
  return structuredClone(invite)
}

export function revokeInviteCode(inviteId: string): TeacherInviteCode | null {
  const invite = getInviteCodesStore().find((entry) => entry.id === inviteId)
  if (!invite) return null
  invite.revokedAt = new Date().toISOString()
  return structuredClone(invite)
}

export function redeemInviteCode(code: string): { planId: string; enrollmentId: string } | null {
  const normalized = code.trim().toUpperCase()
  const invite = getInviteCodesStore().find(
    (entry) => entry.code.toUpperCase() === normalized && !entry.revokedAt,
  )
  if (!invite) return null
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return null
  if (invite.usedCount >= invite.maxUses) return null

  const existing = getEnrollmentsStore().find(
    (entry) => entry.planId === invite.planId && entry.studentEmail === 'student@demo.colearner.ai',
  )
  if (existing) {
    return { planId: invite.planId, enrollmentId: existing.id }
  }

  invite.usedCount += 1
  const enrollment: TeacherEnrollment = {
    id: `enr-${crypto.randomUUID().slice(0, 8)}`,
    planId: invite.planId,
    studentUserId: 'student-demo',
    studentName: 'Demo Student',
    studentEmail: 'student@demo.colearner.ai',
    source: 'invite',
    enrolledAt: new Date().toISOString(),
    status: 'active',
    progressPercent: 0,
    lastExamScore: null,
    lastRecallAt: null,
  }
  getEnrollmentsStore().unshift(enrollment)
  return { planId: invite.planId, enrollmentId: enrollment.id }
}