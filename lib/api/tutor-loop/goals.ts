import { z } from 'zod'
import { TutorLoopApiError, type TutorRequestOptions } from './profile'

export const learnerGoalKindSchema = z.enum([
  'EXAM',
  'LEARNING',
  'SCHOOL',
  'ASSIGNMENT',
  'TEST',
])
export type LearnerGoalKind = z.infer<typeof learnerGoalKindSchema>

export const learnerGoalSourceSchema = z.enum(['LEARNER', 'ONBOARDING', 'ASSIGNED'])
export type LearnerGoalSource = z.infer<typeof learnerGoalSourceSchema>

export const learnerGoalStatusSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export type LearnerGoalStatus = z.infer<typeof learnerGoalStatusSchema>

export const learnerExamSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  title: z.string(),
  date: z.string().nullable(),
  passMarkPercent: z.number().min(0).max(100).nullable(),
  revision: z.number().int().nonnegative(),
})
export type LearnerExamItem = z.infer<typeof learnerExamSchema>

export const learnerGoalTopicSchema = z.object({
  topicId: z.string(),
  weightBps: z.number().int().min(1).max(10000),
})
export type LearnerGoalTopicLink = z.infer<typeof learnerGoalTopicSchema>

export const learnerGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: learnerGoalKindSchema,
  dueDate: z.string().nullable(),
  status: learnerGoalStatusSchema,
  position: z.number().int().nonnegative(),
  source: learnerGoalSourceSchema,
  revision: z.number().int().nonnegative(),
  exam: learnerExamSchema.nullable().optional().transform((val) => val ?? null),
  topics: z.array(learnerGoalTopicSchema).default([]),
})
export type LearnerGoalItem = z.infer<typeof learnerGoalSchema>

export const learnerGoalsListSchema = z.object({
  items: z.array(learnerGoalSchema),
  nextCursor: z.string().nullable(),
})
export type LearnerGoalsList = z.infer<typeof learnerGoalsListSchema>

export const learnerExamsListSchema = z.object({
  items: z.array(learnerExamSchema),
  nextCursor: z.string().nullable(),
})
export type LearnerExamsList = z.infer<typeof learnerExamsListSchema>

export const archivedResourceSchema = z.object({
  id: z.string(),
  status: z.literal('ARCHIVED'),
  revision: z.number().int().nonnegative(),
})
export type ArchivedResource = z.infer<typeof archivedResourceSchema>

export const planTopicBasisSchema = z.enum([
  'SYLLABUS',
  'MATERIAL',
  'SUGGESTION',
  'MANUAL',
])
export type PlanTopicBasis = z.infer<typeof planTopicBasisSchema>

export const draftTopicSchema = z.object({
  title: z.string().min(1).max(120),
  estimateMin: z.number().int().min(5).max(240),
  priority: z.number().int().min(1).max(5),
  basis: planTopicBasisSchema,
  materialIds: z.array(z.string()).default([]),
})
export type DraftTopic = z.infer<typeof draftTopicSchema>

export const draftPhaseSchema = z.object({
  title: z.string().min(1).max(120),
  topics: z.array(draftTopicSchema).min(1),
})
export type DraftPhase = z.infer<typeof draftPhaseSchema>

export const planDraftSchema = z.object({
  title: z.string().min(1).max(120),
  phases: z.array(draftPhaseSchema).min(1),
})
export type PlanDraft = z.infer<typeof planDraftSchema>

export const planDraftStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'READY',
  'FAILED',
  'CANCELLED',
  'ACCEPTED',
])
export type PlanDraftStatus = z.infer<typeof planDraftStatusSchema>

export const planDraftJobSchema = z.object({
  id: z.string(),
  lineageId: z.string(),
  version: z.number().int().positive(),
  status: planDraftStatusSchema,
  draft: planDraftSchema.nullable(),
  reasonCode: z.string().nullable(),
  retryable: z.boolean(),
})
export type PlanDraftJob = z.infer<typeof planDraftJobSchema>

export const tutorPlanTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  estimateMin: z.number().int().min(5).max(240),
  priority: z.number().int().min(1).max(5),
  basis: planTopicBasisSchema,
  materialIds: z.array(z.string()),
  state: z.string(),
  dueDate: z.string().nullable(),
  alreadyKnown: z.boolean(),
  archived: z.boolean(),
  subjectId: z.string().nullable().optional(),
  subjectTitle: z.string().nullable().optional(),
})
export type TutorPlanTopic = z.infer<typeof tutorPlanTopicSchema>

export const tutorPlanPhaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  topics: z.array(tutorPlanTopicSchema),
})
export type TutorPlanPhase = z.infer<typeof tutorPlanPhaseSchema>

export const tutorPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownership: z.enum(['OWN', 'ASSIGNED']),
  state: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
  revision: z.number().int().nonnegative(),
  goalIds: z.array(z.string()),
  phases: z.array(tutorPlanPhaseSchema),
})
export type TutorPlan = z.infer<typeof tutorPlanSchema>

export const tutorLibraryMaterialSchema = z.object({
  id: z.string(),
  title: z.string(),
  subjectId: z.string().nullable().optional(),
  subjectTitle: z.string().nullable().optional(),
  topicIds: z.array(z.string()).default([]),
  sourceType: z.string(),
  status: z.string(),
  sourceVersionRef: z.string().optional(),
  addedViaTutor: z.boolean().optional(),
  externalAttribution: z.unknown().optional(),
  createdAt: z.string().optional(),
})
export type TutorLibraryMaterial = z.infer<typeof tutorLibraryMaterialSchema>

export const tutorLibraryListSchema = z.object({
  items: z.array(tutorLibraryMaterialSchema),
  nextCursor: z.string().nullable().optional(),
  total: z.number().int().nonnegative().optional(),
})

export interface CreateGoalInput {
  clientRequestId: string
  title: string
  kind: LearnerGoalKind
  dueDate?: string | null
  exam?: {
    date: string | null
    passMarkPercent: number | null
  }
  topics?: LearnerGoalTopicLink[]
}

export interface UpdateGoalInput {
  revision: number
  title?: string
  dueDate?: string | null
  topics?: LearnerGoalTopicLink[]
}

export interface CreateExamInput {
  clientRequestId: string
  title: string
  date?: string | null
  passMarkPercent?: number | null
  topics?: LearnerGoalTopicLink[]
}

export interface UpdateExamInput {
  revision: number
  date?: string | null
  passMarkPercent?: number | null
}

export interface StartPlanDraftInput {
  clientRequestId: string
  goalId: string
  planId?: string
  syllabusText?: string
  materialIds?: string[]
}

export interface RegeneratePlanDraftInput {
  clientRequestId: string
  note: string
}

export interface AcceptPlanDraftInput {
  clientRequestId: string
  goalRevision: number
  planRevision?: number
}

export interface CreateManualPlanInput {
  clientRequestId: string
  goalId?: string
  title: string
  phases: DraftPhase[]
}

export const GOAL_KIND_OPTIONS: readonly {
  value: LearnerGoalKind
  label: string
  description: string
  teenOnly?: boolean
}[] = [
  {
    value: 'EXAM',
    label: 'An exam',
    description: 'Board exam, certification, or final test',
  },
  {
    value: 'ASSIGNMENT',
    label: 'Assignment',
    description: 'Homework, project, or lab report with a due date',
  },
  {
    value: 'TEST',
    label: 'Test or quiz',
    description: 'Upcoming class test or topic quiz',
  },
  {
    value: 'LEARNING',
    label: 'Learn something',
    description: 'Build skills at your own pace',
  },
  {
    value: 'SCHOOL',
    label: 'Keep up with school',
    description: 'Follow your classes week by week',
    teenOnly: true,
  },
] as const

export const BASIS_LABELS: Record<PlanTopicBasis, string> = {
  SYLLABUS: 'From syllabus',
  MATERIAL: 'From your material',
  SUGGESTION: 'Co’s suggestion',
  MANUAL: 'Added by you',
}

const DEFAULT_GOALS_FIXTURE: LearnerGoalItem[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Board exams',
    kind: 'EXAM',
    dueDate: null,
    status: 'ACTIVE',
    position: 0,
    source: 'LEARNER',
    revision: 1,
    exam: {
      id: '10000000-0000-4000-8000-000000000002',
      goalId: '10000000-0000-4000-8000-000000000001',
      title: 'Board exams',
      date: '2027-03-02',
      passMarkPercent: null,
      revision: 1,
    },
    topics: [
      {
        topicId: '10000000-0000-4000-8000-000000000004',
        weightBps: 10000,
      },
    ],
  },
]

const DEFAULT_DRAFT_READY_FIXTURE: PlanDraftJob = {
  id: '10000000-0000-4000-8000-000000000007',
  lineageId: '10000000-0000-4000-8000-000000000007',
  version: 1,
  status: 'READY',
  draft: {
    title: 'My board exam plan',
    phases: [
      {
        title: 'Chemistry',
        topics: [
          {
            title: 'Acids, bases and salts',
            estimateMin: 20,
            priority: 4,
            basis: 'MATERIAL',
            materialIds: ['10000000-0000-4000-8000-000000000005'],
          },
          {
            title: 'Chemical reactions',
            estimateMin: 25,
            priority: 3,
            basis: 'SYLLABUS',
            materialIds: [],
          },
        ],
      },
      {
        title: 'Revision',
        topics: [
          {
            title: 'Weak topics review',
            estimateMin: 30,
            priority: 5,
            basis: 'SUGGESTION',
            materialIds: [],
          },
        ],
      },
    ],
  },
  reasonCode: null,
  retryable: false,
}

const DEFAULT_MATERIALS_FIXTURE: TutorLibraryMaterial[] = [
  {
    id: '10000000-0000-4000-8000-000000000005',
    title: 'Class notes · Acids and bases',
    subjectId: '10000000-0000-4000-8000-000000000011',
    subjectTitle: 'Chemistry',
    topicIds: ['10000000-0000-4000-8000-000000000004'],
    sourceType: 'pdf',
    status: 'ready',
    sourceVersionRef: 'source-v1',
    addedViaTutor: false,
    externalAttribution: null,
    createdAt: '2026-11-13T09:00:00Z',
  },
]

let goalsState: LearnerGoalItem[] = structuredClone(DEFAULT_GOALS_FIXTURE)
let draftJobsState: Map<string, PlanDraftJob> = new Map([
  [DEFAULT_DRAFT_READY_FIXTURE.id, structuredClone(DEFAULT_DRAFT_READY_FIXTURE)],
])

export function resetTutorGoalsFixtureState(): void {
  goalsState = structuredClone(DEFAULT_GOALS_FIXTURE)
  draftJobsState = new Map([
    [DEFAULT_DRAFT_READY_FIXTURE.id, structuredClone(DEFAULT_DRAFT_READY_FIXTURE)],
  ])
}

async function goalsFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    options?: TutorRequestOptions
    fallback?: () => T
  },
): Promise<T> {
  const method = init.method ?? 'GET'
  const opts = init.options ?? {}
  const useFallback = opts.useFixtureFallback ?? false
  const base = opts.baseUrl ?? '/api/learn/tutor-loop'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.workspace === 'personal') headers['X-Tutor-Workspace'] = 'personal'
  if (opts.workspace === 'school' && opts.membership) {
    headers['X-School-Membership-Id'] = opts.membership
  }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    })
  } catch {
    if (useFallback && init.fallback) return init.fallback()
    throw new TutorLoopApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Learning services are unavailable right now. Please try again.',
    )
  }

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    const record = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
    const code = typeof record.code === 'string' ? record.code : undefined
    const message =
      typeof record.message === 'string'
        ? record.message
        : 'We could not complete that request. Try again.'
    const retryAfterSeconds =
      typeof record.retryAfterSeconds === 'number' ? record.retryAfterSeconds : undefined

    if (
      useFallback &&
      init.fallback &&
      (response.status === 404 || response.status === 502 || (response.status === 503 && !code))
    ) {
      return init.fallback()
    }
    throw new TutorLoopApiError(
      response.status,
      code ?? `HTTP_${response.status}`,
      message,
      retryAfterSeconds,
    )
  }

  const payload =
    json && typeof json === 'object' && 'data' in json
      ? (json as { data: unknown }).data
      : json
  const parsed = schema.safeParse(payload)
  if (parsed.success) return parsed.data
  if (useFallback && init.fallback) return init.fallback()
  throw new TutorLoopApiError(502, 'INVALID_RESPONSE', 'Unexpected server response.')
}

export async function listGoals(
  includeArchived = false,
  options?: TutorRequestOptions,
): Promise<LearnerGoalsList> {
  return goalsFetch(`/goals?includeArchived=${includeArchived ? 'true' : 'false'}`, learnerGoalsListSchema, {
    method: 'GET',
    options,
    fallback: () => ({
      items: structuredClone(
        goalsState
          .filter((g) => includeArchived || g.status === 'ACTIVE')
          .sort((a, b) => a.position - b.position),
      ),
      nextCursor: null,
    }),
  })
}

export async function getGoal(
  goalId: string,
  options?: TutorRequestOptions,
): Promise<LearnerGoalItem> {
  return goalsFetch(`/goals/${encodeURIComponent(goalId)}`, learnerGoalSchema, {
    method: 'GET',
    options,
    fallback: () => {
      const found = goalsState.find((g) => g.id === goalId) ?? goalsState[0] ?? DEFAULT_GOALS_FIXTURE[0]!
      return structuredClone(found)
    },
  })
}

export async function createGoal(
  input: CreateGoalInput,
  options?: TutorRequestOptions,
): Promise<LearnerGoalItem> {
  const title = input.title.trim()
  if (!title) {
    throw new TutorLoopApiError(400, 'INVALID_REQUEST', 'Enter a title for your goal.')
  }
  if (input.kind !== 'EXAM' && input.exam !== undefined) {
    throw new TutorLoopApiError(
      400,
      'INVALID_REQUEST',
      'Exam details can only be set on an exam goal.',
    )
  }
  const body = {
    clientRequestId: input.clientRequestId,
    title,
    kind: input.kind,
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.kind === 'EXAM'
      ? {
          exam: {
            date: input.exam?.date ?? null,
            passMarkPercent: input.exam?.passMarkPercent ?? null,
          },
        }
      : {}),
    ...(input.topics ? { topics: input.topics } : {}),
  }
  return goalsFetch('/goals', learnerGoalSchema, {
    method: 'POST',
    body,
    options,
    fallback: () => {
      const nextPos = goalsState.filter((g) => g.status === 'ACTIVE').length
      const newId = `10000000-0000-4000-8000-${String(goalsState.length + 30).padStart(12, '0')}`
      const examId = `10000000-0000-4000-8000-${String(goalsState.length + 60).padStart(12, '0')}`
      const created: LearnerGoalItem = {
        id: newId,
        title,
        kind: input.kind,
        dueDate: input.kind === 'EXAM' ? null : (input.dueDate ?? null),
        status: 'ACTIVE',
        position: nextPos,
        source: 'LEARNER',
        revision: 1,
        exam:
          input.kind === 'EXAM'
            ? {
                id: examId,
                goalId: newId,
                title,
                date: input.exam?.date ?? null,
                passMarkPercent: input.exam?.passMarkPercent ?? null,
                revision: 1,
              }
            : null,
        topics: input.topics ? [...input.topics] : [],
      }
      goalsState = [...goalsState, created]
      return structuredClone(created)
    },
  })
}

export async function updateGoal(
  goalId: string,
  input: UpdateGoalInput,
  options?: TutorRequestOptions,
): Promise<LearnerGoalItem> {
  const existing = goalsState.find((g) => g.id === goalId)
  if (existing?.source === 'ASSIGNED') {
    throw new TutorLoopApiError(
      409,
      'PLAN_READ_ONLY',
      'This goal is set by your school and cannot be edited.',
    )
  }
  const body = {
    revision: input.revision,
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.topics !== undefined ? { topics: input.topics } : {}),
  }
  return goalsFetch(`/goals/${encodeURIComponent(goalId)}`, learnerGoalSchema, {
    method: 'PATCH',
    body,
    options,
    fallback: () => {
      const target = goalsState.find((g) => g.id === goalId) ?? DEFAULT_GOALS_FIXTURE[0]!
      const updated: LearnerGoalItem = {
        ...target,
        title: body.title ?? target.title,
        dueDate: body.dueDate !== undefined ? body.dueDate : target.dueDate,
        topics: body.topics ?? target.topics,
        revision: input.revision + 1,
        exam: target.exam
          ? {
              ...target.exam,
              title: body.title ?? target.exam.title,
            }
          : null,
      }
      goalsState = goalsState.map((g) => (g.id === goalId ? updated : g))
      return structuredClone(updated)
    },
  })
}

export async function archiveGoal(
  goalId: string,
  revision: number,
  options?: TutorRequestOptions,
): Promise<ArchivedResource> {
  return goalsFetch(
    `/goals/${encodeURIComponent(goalId)}?revision=${encodeURIComponent(String(revision))}`,
    archivedResourceSchema,
    {
      method: 'DELETE',
      options,
      fallback: () => {
        goalsState = goalsState.map((g) =>
          g.id === goalId ? { ...g, status: 'ARCHIVED', revision: revision + 1 } : g,
        )
        return {
          id: goalId,
          status: 'ARCHIVED' as const,
          revision: revision + 1,
        }
      },
    },
  )
}

export async function reorderGoals(
  ordered: { id: string; revision: number }[],
  options?: TutorRequestOptions,
): Promise<LearnerGoalsList> {
  return goalsFetch('/goals/order', learnerGoalsListSchema, {
    method: 'PUT',
    body: { ordered },
    options,
    fallback: () => {
      const orderIndex = new Map(ordered.map((item, idx) => [item.id, idx]))
      goalsState = goalsState.map((g) => {
        const idx = orderIndex.get(g.id)
        if (idx === undefined) return g
        return {
          ...g,
          position: idx,
          revision: g.revision + 1,
        }
      })
      const active = goalsState
        .filter((g) => g.status === 'ACTIVE')
        .sort((a, b) => a.position - b.position)
      return {
        items: structuredClone(active),
        nextCursor: null,
      }
    },
  })
}

export async function listExams(options?: TutorRequestOptions): Promise<LearnerExamsList> {
  return goalsFetch('/exams', learnerExamsListSchema, {
    method: 'GET',
    options,
    fallback: () => ({
      items: structuredClone(
        goalsState
          .filter((g) => g.status === 'ACTIVE' && g.kind === 'EXAM' && g.exam)
          .map((g) => g.exam!),
      ),
      nextCursor: null,
    }),
  })
}

export async function updateExam(
  examId: string,
  input: UpdateExamInput,
  options?: TutorRequestOptions,
): Promise<LearnerExamItem> {
  return goalsFetch(`/exams/${encodeURIComponent(examId)}`, learnerExamSchema, {
    method: 'PATCH',
    body: {
      revision: input.revision,
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.passMarkPercent !== undefined ? { passMarkPercent: input.passMarkPercent } : {}),
    },
    options,
    fallback: () => {
      let updatedExam: LearnerExamItem = {
        id: examId,
        goalId: '10000000-0000-4000-8000-000000000001',
        title: 'Board exams',
        date: input.date ?? null,
        passMarkPercent: input.passMarkPercent ?? null,
        revision: input.revision + 1,
      }
      goalsState = goalsState.map((g) => {
        if (g.exam?.id !== examId) return g
        updatedExam = {
          ...g.exam,
          date: input.date !== undefined ? input.date : g.exam.date,
          passMarkPercent:
            input.passMarkPercent !== undefined ? input.passMarkPercent : g.exam.passMarkPercent,
          revision: input.revision + 1,
        }
        return { ...g, exam: updatedExam }
      })
      return structuredClone(updatedExam)
    },
  })
}

export async function startPlanDraft(
  input: StartPlanDraftInput,
  options?: TutorRequestOptions,
): Promise<PlanDraftJob> {
  const body = {
    clientRequestId: input.clientRequestId,
    goalId: input.goalId,
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.syllabusText?.trim() ? { syllabusText: input.syllabusText.trim() } : {}),
    ...(input.materialIds && input.materialIds.length > 0
      ? { materialIds: input.materialIds }
      : {}),
  }
  return goalsFetch('/plan-drafts', planDraftJobSchema, {
    method: 'POST',
    body,
    options,
    fallback: () => {
      const job: PlanDraftJob = structuredClone(DEFAULT_DRAFT_READY_FIXTURE)
      draftJobsState.set(job.id, job)
      return structuredClone(job)
    },
  })
}

export async function getPlanDraft(
  jobId: string,
  options?: TutorRequestOptions,
): Promise<PlanDraftJob> {
  return goalsFetch(`/plan-drafts/${encodeURIComponent(jobId)}`, planDraftJobSchema, {
    method: 'GET',
    options,
    fallback: () => {
      const existing = draftJobsState.get(jobId) ?? DEFAULT_DRAFT_READY_FIXTURE
      const ready: PlanDraftJob =
        existing.status === 'QUEUED' || existing.status === 'RUNNING'
          ? {
              ...existing,
              status: 'READY',
              draft: existing.draft ?? DEFAULT_DRAFT_READY_FIXTURE.draft,
            }
          : existing
      draftJobsState.set(jobId, ready)
      return structuredClone(ready)
    },
  })
}

export async function cancelPlanDraft(
  jobId: string,
  options?: TutorRequestOptions,
): Promise<PlanDraftJob> {
  return goalsFetch(`/plan-drafts/${encodeURIComponent(jobId)}/cancel`, planDraftJobSchema, {
    method: 'POST',
    options,
    fallback: () => {
      const existing = draftJobsState.get(jobId) ?? DEFAULT_DRAFT_READY_FIXTURE
      const cancelled: PlanDraftJob = {
        ...existing,
        status: 'CANCELLED',
        draft: null,
        reasonCode: null,
        retryable: false,
      }
      draftJobsState.set(jobId, cancelled)
      return structuredClone(cancelled)
    },
  })
}

export async function regeneratePlanDraft(
  jobId: string,
  input: RegeneratePlanDraftInput,
  options?: TutorRequestOptions,
): Promise<PlanDraftJob> {
  const note = input.note.trim()
  if (!note || note.length > 600) {
    throw new TutorLoopApiError(
      400,
      'INVALID_REQUEST',
      'Enter a note up to 600 characters to tell your tutor what to adjust.',
    )
  }
  return goalsFetch(`/plan-drafts/${encodeURIComponent(jobId)}/regenerate`, planDraftJobSchema, {
    method: 'POST',
    body: {
      clientRequestId: input.clientRequestId,
      note,
    },
    options,
    fallback: () => {
      const existing = draftJobsState.get(jobId) ?? DEFAULT_DRAFT_READY_FIXTURE
      const nextJob: PlanDraftJob = {
        ...existing,
        version: existing.version + 1,
        status: 'READY',
        draft: existing.draft ?? DEFAULT_DRAFT_READY_FIXTURE.draft,
        reasonCode: null,
        retryable: false,
      }
      draftJobsState.set(jobId, nextJob)
      return structuredClone(nextJob)
    },
  })
}

export async function acceptPlanDraft(
  jobId: string,
  input: AcceptPlanDraftInput,
  options?: TutorRequestOptions,
): Promise<TutorPlan> {
  return goalsFetch(`/plan-drafts/${encodeURIComponent(jobId)}/accept`, tutorPlanSchema, {
    method: 'POST',
    body: {
      clientRequestId: input.clientRequestId,
      goalRevision: input.goalRevision,
      ...(input.planRevision !== undefined ? { planRevision: input.planRevision } : {}),
    },
    options,
    fallback: () => {
      const existing = draftJobsState.get(jobId) ?? DEFAULT_DRAFT_READY_FIXTURE
      const draft = existing.draft ?? DEFAULT_DRAFT_READY_FIXTURE.draft!
      return {
        id: '10000000-0000-4000-8000-000000000003',
        title: draft.title,
        ownership: 'OWN',
        state: 'ACTIVE',
        revision: (input.planRevision ?? 0) + 1,
        goalIds: ['10000000-0000-4000-8000-000000000001'],
        phases: draft.phases.map((ph, pIdx) => ({
          id: `10000000-0000-4000-8000-${String(pIdx + 17).padStart(12, '0')}`,
          title: ph.title,
          topics: ph.topics.map((t, tIdx) => ({
            id: `10000000-0000-4000-8000-${String(tIdx + 4).padStart(12, '0')}`,
            title: t.title,
            estimateMin: t.estimateMin,
            priority: t.priority,
            basis: t.basis,
            materialIds: t.materialIds,
            state: 'LEARNING',
            dueDate: null,
            alreadyKnown: false,
            archived: false,
            subjectId: '10000000-0000-4000-8000-000000000011',
            subjectTitle: ph.title,
          })),
        })),
      }
    },
  })
}

export async function createManualPlan(
  input: CreateManualPlanInput,
  options?: TutorRequestOptions,
): Promise<TutorPlan> {
  const title = input.title.trim()
  if (!title) {
    throw new TutorLoopApiError(400, 'INVALID_REQUEST', 'Enter a plan title.')
  }
  if (!input.phases.length || input.phases.some((ph) => !ph.title.trim() || !ph.topics.length)) {
    throw new TutorLoopApiError(
      400,
      'INVALID_REQUEST',
      'Add at least one phase and one topic to your plan.',
    )
  }
  return goalsFetch('/plans', tutorPlanSchema, {
    method: 'POST',
    body: {
      clientRequestId: input.clientRequestId,
      ...(input.goalId ? { goalId: input.goalId } : {}),
      title,
      phases: input.phases.map((ph) => ({
        title: ph.title.trim(),
        topics: ph.topics.map((t) => ({
          title: t.title.trim(),
          estimateMin: Math.min(240, Math.max(5, Math.round(t.estimateMin))),
          priority: Math.min(5, Math.max(1, Math.round(t.priority))),
          basis: 'MANUAL' as const,
          materialIds: t.materialIds ?? [],
        })),
      })),
    },
    options,
    fallback: () => ({
      id: '10000000-0000-4000-8000-000000000003',
      title,
      ownership: 'OWN',
      state: 'ACTIVE',
      revision: 1,
      goalIds: input.goalId ? [input.goalId] : ['10000000-0000-4000-8000-000000000001'],
      phases: input.phases.map((ph, pIdx) => ({
        id: `10000000-0000-4000-8000-${String(pIdx + 17).padStart(12, '0')}`,
        title: ph.title.trim(),
        topics: ph.topics.map((t, tIdx) => ({
          id: `10000000-0000-4000-8000-${String(tIdx + 4).padStart(12, '0')}`,
          title: t.title.trim(),
          estimateMin: Math.min(240, Math.max(5, Math.round(t.estimateMin))),
          priority: Math.min(5, Math.max(1, Math.round(t.priority))),
          basis: 'MANUAL',
          materialIds: t.materialIds ?? [],
          state: 'NOT_STARTED',
          dueDate: null,
          alreadyKnown: false,
          archived: false,
          subjectId: null,
          subjectTitle: ph.title.trim(),
        })),
      })),
    }),
  })
}

export async function listAvailableMaterials(
  options?: TutorRequestOptions,
): Promise<TutorLibraryMaterial[]> {
  const result = await goalsFetch('/library?status=ready&limit=20', tutorLibraryListSchema, {
    method: 'GET',
    options,
    fallback: () => ({
      items: structuredClone(DEFAULT_MATERIALS_FIXTURE),
      nextCursor: null,
      total: DEFAULT_MATERIALS_FIXTURE.length,
    }),
  })
  return result.items
}
