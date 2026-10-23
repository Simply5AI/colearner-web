import { ApiError } from '@/lib/api/client'
import { TeachingApiError } from '@/lib/api/teaching/core'
import type { TeachingContextData, TeachingDashboard, TeachingClass } from '@/lib/api/teaching/dashboard'

/** Development fixtures only. Every value below is synthetic; no platform, database or model is called. */
export const FIXTURE_NOW = '2026-10-22T08:00:00.000Z'

export const classes: TeachingClass[] = [
  {
    classId: 'class-6a', label: 'CBSE · Class 6 A', board: 'CBSE', grade: 6, section: 'A', academicYear: '2026-27', rosterCount: 28,
    subjects: [
      { subject: 'Mathematics', curriculumSubjectId: 'cur-math-6', curriculumStatus: 'COVERED' },
      { subject: 'Science', curriculumSubjectId: null, curriculumStatus: 'NOT_LOADED' },
    ],
  },
  {
    classId: 'class-8b', label: 'CBSE · Class 8 B', board: 'CBSE', grade: 8, section: 'B', academicYear: '2026-27', rosterCount: 24,
    subjects: [{ subject: 'Mathematics', curriculumSubjectId: 'cur-math-8', curriculumStatus: 'PARTIAL' }],
  },
]

const unavailableAi = (reason: string) => ({ status: 'UNAVAILABLE' as const, code: 'TEACHER_AI_NOT_INSTALLED' as const, reason })
const AI_REASON = 'Co drafting for teachers is not installed yet. Everything here works by hand.'

export function contextFixture(options: { noClass?: boolean; photo?: boolean } = {}): TeachingContextData {
  return {
    school: { id: 'school-fixture', name: 'Fixture Public School' },
    teacher: { userId: 'teacher-fixture', displayName: 'Daniel Okafor' },
    classes: options.noClass ? [] : classes,
    features: {
      aiDrafting: {
        draftPlan: unavailableAi(AI_REASON), generateLesson: unavailableAi(AI_REASON),
        generateWorksheet: unavailableAi(AI_REASON), differentiate: unavailableAi(AI_REASON),
      },
      curriculumSource: { available: true, reason: null },
      outlineSource: { available: true },
      syllabusUpload: { available: false, reason: 'Reading an uploaded syllabus needs Co, which is not available yet.' },
      photoUpload: { available: options.photo ?? true, reason: options.photo === false ? 'File storage is not set up for this school.' : null },
      studentAssignment: { available: true, reason: null },
      inviteStudents: { available: false, reason: 'Invite codes, links and QR codes arrive with the invitations release.' },
      worksheetExport: { available: false, reason: 'Worksheet export arrives in a later release.' },
    },
  }
}

const deferred = {
  atRiskAlerts: { available: false as const, reason: 'Concept-level alerts need scoped mastery data that arrives with student insights.' },
  worksheetDrafts: { available: false as const, reason: 'Worksheet drafts arrive with the worksheet release.' },
  extraPractice: { available: false as const, reason: 'Assigning extra practice arrives with student insights.' },
}

const base = (): TeachingDashboard => ({
  state: 'ACTIVE',
  school: { id: 'school-fixture', name: 'Fixture Public School' },
  teacher: { displayName: 'Daniel Okafor' },
  classes,
  week: { from: '2026-10-15T00:00:00.000Z', to: '2026-10-22T00:00:00.000Z' },
  activity: { evidence: 'ENOUGH', enrolledLearners: 12, activeLearners: 9 },
  plans: { draft: 1, published: 2, archived: 0 },
  dueThisWeek: [
    { planId: 'plan-fractions', planTitle: 'Class 6 Fractions', topicId: 'topic-equiv', topicTitle: 'Equivalent fractions', dueAt: '2026-10-24T00:00:00.000Z' },
    { planId: 'plan-fractions', planTitle: 'Class 6 Fractions', topicId: 'topic-add', topicTitle: 'Adding fractions', dueAt: '2026-10-27T00:00:00.000Z' },
  ],
  planProgress: [
    { planId: 'plan-fractions', title: 'Class 6 Fractions', classLabel: 'CBSE · Class 6 A', enrolledActive: 9, pendingGuardian: 3, averageProgress: 42 },
    { planId: 'plan-algebra', title: 'Class 8 Algebra', classLabel: 'CBSE · Class 8 B', enrolledActive: 2, pendingGuardian: 0, averageProgress: null },
  ],
  drafts: [],
  recent: [
    { kind: 'ENROLMENT_JOINED', at: '2026-10-21T09:00:00.000Z', planId: 'plan-fractions', label: 'Class 6 Fractions', learnerLabel: 'Mango' },
    { kind: 'ENROLMENT_PENDING_GUARDIAN', at: '2026-10-21T07:00:00.000Z', planId: 'plan-fractions', label: 'Class 6 Fractions', learnerLabel: 'Pebble' },
    { kind: 'LESSON_PUBLISHED', at: '2026-10-20T12:00:00.000Z', planId: 'plan-fractions', label: 'Equivalent fractions', learnerLabel: null },
  ],
  checklist: [
    { key: 'CREATE_PLAN', done: true, action: { enabled: true, route: '/teacher/plans/new', disabledReason: null } },
    { key: 'ADD_MATERIAL', done: true, action: { enabled: true, route: '/teacher/plans/plan-fractions', disabledReason: null } },
    { key: 'INVITE_STUDENTS', done: true, action: { enabled: true, route: '/teacher/plans/plan-fractions?assign=1', disabledReason: null } },
  ],
  deferred,
})

export function dashboardFixture(state: string): TeachingDashboard {
  const dashboard = base()
  if (state === 'no-class') {
    return {
      ...dashboard, state: 'NO_CLASS', classes: [], activity: { evidence: 'NONE', enrolledLearners: 0, activeLearners: null },
      plans: { draft: 0, published: 0, archived: 0 }, dueThisWeek: [], planProgress: [], recent: [],
      checklist: dashboard.checklist.map((item) => ({ ...item, done: false, action: { enabled: false, route: null, disabledReason: 'No class is assigned to you yet.' } })),
    }
  }
  if (state === 'new-teacher') {
    return {
      ...dashboard, state: 'NEW_TEACHER', activity: { evidence: 'NONE', enrolledLearners: 0, activeLearners: null },
      plans: { draft: 0, published: 0, archived: 0 }, dueThisWeek: [], planProgress: [], recent: [],
      checklist: [
        { key: 'CREATE_PLAN', done: false, action: { enabled: true, route: '/teacher/plans/new', disabledReason: null } },
        { key: 'ADD_MATERIAL', done: false, action: { enabled: false, route: null, disabledReason: 'Create a plan first.' } },
        { key: 'INVITE_STUDENTS', done: false, action: { enabled: false, route: null, disabledReason: 'Publish a plan first.' } },
      ],
    }
  }
  if (state === 'draft-ready') {
    return {
      ...dashboard, plans: { draft: 2, published: 1, archived: 0 },
      drafts: [
        { kind: 'LESSON', planId: 'plan-fractions', topicId: 'topic-add', title: 'Adding fractions (lesson draft)', updatedAt: '2026-10-21T15:00:00.000Z' },
        { kind: 'PLAN', planId: 'plan-algebra', topicId: null, title: 'Class 8 Algebra', updatedAt: '2026-10-19T10:00:00.000Z' },
      ],
    }
  }
  if (state === 'unpublished') {
    return {
      ...dashboard, activity: { evidence: 'NONE', enrolledLearners: 0, activeLearners: null }, plans: { draft: 1, published: 0, archived: 0 },
      dueThisWeek: [], planProgress: [], recent: [],
      drafts: [{ kind: 'PLAN', planId: 'plan-algebra', topicId: null, title: 'Class 8 Algebra', updatedAt: '2026-10-19T10:00:00.000Z' }],
      checklist: [
        { key: 'CREATE_PLAN', done: true, action: { enabled: true, route: '/teacher/plans/new', disabledReason: null } },
        { key: 'ADD_MATERIAL', done: false, action: { enabled: true, route: '/teacher/plans/plan-algebra', disabledReason: null } },
        { key: 'INVITE_STUDENTS', done: false, action: { enabled: false, route: null, disabledReason: 'Publish a plan first.' } },
      ],
    }
  }
  if (state === 'insufficient') {
    return { ...dashboard, planProgress: dashboard.planProgress.map((plan) => ({ ...plan, averageProgress: null })) }
  }
  if (state === 'assignable') {
    return {
      ...dashboard,
      checklist: dashboard.checklist.map((item) => (item.key === 'INVITE_STUDENTS' ? { ...item, done: false } : item)),
    }
  }
  return dashboard
}

export const never = () => new Promise<never>(() => undefined)
export const denied = () => new TeachingApiError(403, 'You do not have permission for this school or action.', 'FORBIDDEN')
export const unavailable = () => new TeachingApiError(503, 'Teaching workspace is unavailable right now. Your draft is still here; try again.', 'TEACHING_UNAVAILABLE')
export const serverError = () => new ApiError(500, 'Teaching services are unavailable. Please try again.')
export const notFound = () => new TeachingApiError(404, 'That item was not found, or you no longer have access to it.', 'NOT_FOUND')
export const conflict = () => new TeachingApiError(409, 'This conflicts with the current record. Refresh and review before retrying.', 'REVISION_CONFLICT', 3)

/** Plan detail in the exact contract 6.3 shape; used by W1 harnesses so W2's components parse it. */
export function planDetailFixture(
  planId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  options: { title?: string; visibility?: 'NOT_PUBLISHED' | 'PUBLISHED_NOT_ASSIGNED' | 'ASSIGNED_PENDING_APPROVAL' | 'ASSIGNED'; withTopic?: boolean } = {},
) {
  const title = options.title ?? 'Class 6 Fractions'
  const published = status === 'PUBLISHED'
  return {
    id: planId, title, status,
    scope: { classId: 'class-6a', classLabel: 'CBSE · Class 6 A', subject: 'Mathematics', curriculumSubjectId: 'cur-math-6', curriculumLabel: null, targetBand: '6-9' as const, origin: 'SCRATCH' as const },
    students: { roster: 28, enrolledActive: 0, pendingGuardian: 0 },
    averageProgress: null, topicCount: options.withTopic === false ? 0 : 1, updatedAt: FIXTURE_NOW, publishedAt: published ? FIXTURE_NOW : null,
    description: null, revision: 1,
    tree: options.withTopic === false ? [] : [{
      id: 'phase-1', kind: 'module' as const, title: 'Phase 1', description: null, sortOrder: 0, dueAt: null, prerequisiteTopicIds: [],
      counts: { materials: 0, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' as const },
      children: [{
        id: 'topic-1', kind: 'topic' as const, title: 'What is a fraction?', description: null, sortOrder: 0, dueAt: null, prerequisiteTopicIds: [],
        counts: { materials: 0, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' as const }, children: [],
      }],
    }],
    eligibility: { targetBand: '6-9' as const, defaultBandForGrade: '10-13' as const, rosterByBand: { '6-9': 20, '10-13': 6, '14-17': 0 }, unknownBand: 2, outsideTarget: 6, note: null },
    readiness: { publishable: true, issues: [] },
    studentVisibility: { state: options.visibility ?? (published ? 'PUBLISHED_NOT_ASSIGNED' : 'NOT_PUBLISHED'), assignedClassIds: [] as string[] },
    frozen: published,
  }
}

export function assignmentFixture(planId: string, classId = 'class-6a', classLabel = 'CBSE · Class 6 A') {
  return {
    id: `assignment-${planId}-${classId}`, planId, classId, classLabel, dueAt: null, source: 'TEACHER' as const, createdAt: FIXTURE_NOW,
    roster: { total: 28, enrolledActive: 0, pendingGuardian: 24, alreadyEnrolled: 0, skipped: [{ count: 4, reason: 'NO_ACCOUNT' as const }] },
    changed: true,
  }
}
