export interface TeacherEnrollment {
  id: string
  planId: string
  studentUserId: string
  studentName: string
  studentEmail: string
  source: 'invite' | 'org'
  enrolledAt: string
  status: 'active' | 'revoked'
  progressPercent: number
  lastExamScore: number | null
  lastRecallAt: string | null
}

export interface TeacherInviteCode {
  id: string
  planId: string
  code: string
  maxUses: number
  usedCount: number
  expiresAt: string | null
  createdAt: string
  createdBy: string
  revokedAt: string | null
}

export const seedEnrollments: TeacherEnrollment[] = [
  {
    id: 'enr-1',
    planId: 'plan-algorithms-101',
    studentUserId: 'student-demo',
    studentName: 'Demo Student',
    studentEmail: 'student@demo.colearner.ai',
    source: 'invite',
    enrolledAt: '2026-06-02T10:00:00.000Z',
    status: 'active',
    progressPercent: 42,
    lastExamScore: 78,
    lastRecallAt: '2026-06-12T18:30:00.000Z',
  },
]

export const seedInviteCodes: TeacherInviteCode[] = [
  {
    id: 'inv-1',
    planId: 'plan-algorithms-101',
    code: 'ALGO-2026',
    maxUses: 25,
    usedCount: 12,
    expiresAt: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-06-01T09:00:00.000Z',
    createdBy: 'teacher@demo.colearner.ai',
    revokedAt: null,
  },
]