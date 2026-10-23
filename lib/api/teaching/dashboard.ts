import { z } from 'zod/v4'

/** B12 section 6.1 and 6.2. Local Zod schemas; the vendored api-client 0.4.0 has no teaching types. */
const iso = z.string().min(1)
const unavailableSchema = z.object({ available: z.literal(false), reason: z.string() })
const availabilitySchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
})

export const teachingAiStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('UNAVAILABLE'),
    code: z.enum(['TEACHER_AI_NOT_INSTALLED', 'DISABLED_BY_OPERATOR', 'POLICY']),
    reason: z.string(),
  }),
  z.object({
    status: z.literal('AVAILABLE'),
    taskKey: z.string(),
    packVersion: z.string(),
  }),
])
export type TeachingAiState = z.infer<typeof teachingAiStateSchema>

export const teachingClassSchema = z.object({
  classId: z.string(),
  label: z.string(),
  board: z.enum(['CBSE', 'ICSE']),
  grade: z.number(),
  section: z.string(),
  academicYear: z.string(),
  rosterCount: z.number(),
  subjects: z.array(
    z.object({
      subject: z.string(),
      curriculumSubjectId: z.string().nullable(),
      curriculumStatus: z.enum(['COVERED', 'PARTIAL', 'NOT_LOADED', 'UNMAPPED']),
    }),
  ),
})
export type TeachingClass = z.infer<typeof teachingClassSchema>

export const teachingContextSchema = z.object({
  school: z.object({ id: z.string(), name: z.string() }),
  teacher: z.object({ userId: z.string(), displayName: z.string() }),
  classes: z.array(teachingClassSchema),
  features: z.object({
    aiDrafting: z.object({
      draftPlan: teachingAiStateSchema,
      generateLesson: teachingAiStateSchema,
      generateWorksheet: teachingAiStateSchema,
      differentiate: teachingAiStateSchema,
    }),
    curriculumSource: availabilitySchema,
    outlineSource: z.object({ available: z.literal(true) }),
    syllabusUpload: unavailableSchema,
    photoUpload: availabilitySchema,
    studentAssignment: availabilitySchema,
    inviteStudents: unavailableSchema,
    worksheetExport: unavailableSchema,
  }),
})
export type TeachingContextData = z.infer<typeof teachingContextSchema>

const actionSchema = z.object({
  enabled: z.boolean(),
  route: z.string().nullable(),
  disabledReason: z.string().nullable(),
})

export const teachingDashboardSchema = z.object({
  state: z.enum(['NO_CLASS', 'NEW_TEACHER', 'ACTIVE']),
  school: z.object({ id: z.string(), name: z.string() }),
  teacher: z.object({ displayName: z.string() }),
  classes: z.array(teachingClassSchema),
  week: z.object({ from: iso, to: iso }),
  activity: z.object({
    evidence: z.enum(['NONE', 'ENOUGH']),
    enrolledLearners: z.number(),
    activeLearners: z.number().nullable(),
  }),
  plans: z.object({ draft: z.number(), published: z.number(), archived: z.number() }),
  dueThisWeek: z.array(
    z.object({
      planId: z.string(),
      planTitle: z.string(),
      topicId: z.string(),
      topicTitle: z.string(),
      dueAt: iso,
    }),
  ),
  planProgress: z.array(
    z.object({
      planId: z.string(),
      title: z.string(),
      classLabel: z.string(),
      enrolledActive: z.number(),
      pendingGuardian: z.number(),
      averageProgress: z.number().nullable(),
    }),
  ),
  drafts: z.array(
    z.object({
      kind: z.enum(['PLAN', 'LESSON']),
      planId: z.string(),
      topicId: z.string().nullable(),
      title: z.string(),
      updatedAt: iso,
    }),
  ),
  recent: z.array(
    z.object({
      kind: z.enum([
        'PLAN_PUBLISHED',
        'LESSON_PUBLISHED',
        'ENROLMENT_JOINED',
        'ENROLMENT_PENDING_GUARDIAN',
      ]),
      at: iso,
      planId: z.string(),
      label: z.string(),
      learnerLabel: z.string().nullable(),
    }),
  ),
  checklist: z.array(
    z.object({
      key: z.enum(['CREATE_PLAN', 'ADD_MATERIAL', 'INVITE_STUDENTS']),
      done: z.boolean(),
      action: actionSchema,
    }),
  ),
  deferred: z.object({
    atRiskAlerts: unavailableSchema,
    worksheetDrafts: unavailableSchema,
    extraPractice: unavailableSchema,
  }),
})
export type TeachingDashboard = z.infer<typeof teachingDashboardSchema>

export const parseTeachingContext = (value: unknown) => teachingContextSchema.parse(value)
export const parseTeachingDashboard = (value: unknown) => teachingDashboardSchema.parse(value)

/** The published own plan the checklist points at: `/teacher/plans/{planId}?assign=1`. */
export function assignablePlanId(dashboard: TeachingDashboard): string | null {
  const item = dashboard.checklist.find((entry) => entry.key === 'INVITE_STUDENTS')
  if (!item?.action.enabled || !item.action.route) return null
  const match = /^\/teacher\/plans\/([^/?#]+)/.exec(item.action.route)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

/** Where "Create lesson" goes: a lesson draft first, then any plan the teacher already has. */
export function createLessonTarget(dashboard: TeachingDashboard): string | null {
  const lesson = dashboard.drafts.find((draft) => draft.kind === 'LESSON' && draft.topicId)
  if (lesson?.topicId) return `/teacher/plans/${encodeURIComponent(lesson.planId)}/topics/${encodeURIComponent(lesson.topicId)}`
  const plan = dashboard.drafts[0]?.planId ?? dashboard.planProgress[0]?.planId ?? dashboard.recent[0]?.planId
  return plan ? `/teacher/plans/${encodeURIComponent(plan)}` : null
}
