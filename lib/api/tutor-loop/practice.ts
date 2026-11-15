import { z } from 'zod'
import {
  learnerExamSchema,
  learnerGoalSchema,
  sourceCitationSchema,
  tutorActionSchema,
  tutorLoopGet,
  tutorLoopPost,
  tutorLoopPut,
  tutorNextStepSchema,
  tutorPlanTopicSchema,
  type TutorRequestOptions,
} from './client'
import { questionViewSchema } from '@/lib/api/practice'
import type { PracticeAnswer, QuestionView } from '@/components/practice/session/practice-types'

/**
 * W4 typed client for Practice, exam prep, mocks and short lessons (contract sections 4 and 6).
 * Shapes follow the contract fixtures and accept the extra fields P3 actually returns (all optional).
 */

export const confidenceSchema = z.enum(['SURE', 'SOMEWHAT', 'GUESSING'])
export type Confidence = z.infer<typeof confidenceSchema>

export const tutorQuestionKinds = ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'CLOZE', 'ORDERING'] as const
export type TutorQuestionKind = (typeof tutorQuestionKinds)[number]

/* ---------- practice by goal ---------- */

export const weakConceptSchema = z.object({
  conceptId: z.string(),
  topicId: z.string().nullable().optional(),
  label: z.string(),
  state: z.string(),
  qualifyingAttempts: z.number(),
  rate: z.number().nullable().optional(),
})
export type WeakConcept = z.infer<typeof weakConceptSchema>

export const recentSessionSchema = z.object({
  sessionId: z.string(),
  kind: z.enum(['PRACTICE', 'MOCK']),
  topicId: z.string().nullable().optional(),
  status: z.string(),
  itemCount: z.number(),
  startedAt: z.string(),
  completedAt: z.string().nullable().optional(),
})
export type RecentSession = z.infer<typeof recentSessionSchema>

export const practiceSchema = z.object({
  goalCards: z.array(learnerGoalSchema),
  dueReview: z.object({ itemCount: z.number(), estimatedMinutes: z.number() }),
  topics: z.array(tutorPlanTopicSchema),
  recentSessions: z.array(recentSessionSchema).default([]),
  weakConcepts: z.array(weakConceptSchema).default([]),
})
export type TutorPractice = z.infer<typeof practiceSchema>

export const practiceTopicSchema = z.object({
  topic: tutorPlanTopicSchema,
  materials: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()).default([]),
  inShort: z
    .object({
      text: z.string(),
      source: z.string(),
      citation: sourceCitationSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  example: z.object({ text: z.string() }).passthrough().nullable().optional(),
  actions: z.array(tutorActionSchema).default([]),
})
export type PracticeTopic = z.infer<typeof practiceTopicSchema>

/* ---------- question sets and sessions ---------- */

export const questionSetSchema = z.object({
  id: z.string(),
  sessionId: z.string().nullable().optional(),
  status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']),
  topicId: z.string(),
  questionCount: z.number().nullable(),
  reasonCode: z.string().nullable(),
  retryable: z.boolean(),
})
export type QuestionSetView = z.infer<typeof questionSetSchema>

export const sessionItemSchema = z.object({
  index: z.number(),
  itemId: z.string(),
  state: z.string().optional(),
  question: questionViewSchema,
})
export type SessionItem = { index: number; itemId: string; state?: string; question: QuestionView }

export const hintSchema = z.object({
  index: z.number(),
  itemId: z.string(),
  level: z.number(),
  text: z.string(),
  remaining: z.number(),
})
export type HintReceipt = z.infer<typeof hintSchema>

export const practiceAnswerSchema = z.object({
  sessionId: z.string(),
  itemId: z.string(),
  attemptId: z.string(),
  attemptNo: z.number(),
  gradingStatus: z.string(),
  score: z.number().nullable(),
  correct: z.boolean().nullable(),
  confidence: z.string().nullable().optional(),
  replay: z.boolean(),
  /** Only when the item is settled and objectively graded; null otherwise. */
  explanation: z.string().nullable().optional(),
})
export type PracticeAnswerReceipt = z.infer<typeof practiceAnswerSchema>

export const finishSchema = z.object({ sessionId: z.string(), status: z.string() })

/* ---------- exam prep ---------- */

export const readinessSchema = z.object({
  examId: z.string(),
  blueprintRevision: z.string().or(z.number()),
  percent: z.number().nullable(),
  topicsCovered: z.number(),
  topicsTotal: z.number(),
  evidence: z.enum(['ENOUGH', 'INSUFFICIENT']),
  asOf: z.string(),
})
export type ExamReadiness = z.infer<typeof readinessSchema>

export const pastMockSchema = z.object({
  sessionId: z.string(),
  preset: z.string().nullable().optional(),
  conditions: z.boolean().optional(),
  status: z.string(),
  scorePercent: z.number().nullable(),
  submittedAt: z.string(),
})
export type PastMock = z.infer<typeof pastMockSchema>

export const examPrepSchema = z.object({
  state: z.enum(['NO_EXAM', 'NOT_ENOUGH_PRACTICE', 'MEASURED', 'EXAM_PASSED']).optional(),
  exams: z.array(learnerExamSchema),
  selectedExamId: z.string().nullable().optional(),
  countdown: z.object({ state: z.string(), days: z.number().nullable() }).optional(),
  readiness: readinessSchema.nullable(),
  weakConcepts: z.array(weakConceptSchema).default([]),
  pastMocks: z.array(pastMockSchema).default([]),
  mockAvailable: z.boolean().optional(),
  examLocked: z.boolean().optional(),
})
export type ExamPrep = z.infer<typeof examPrepSchema>

/* ---------- mock ---------- */

export const mockPresets = {
  QUICK: { questions: 10, minutes: 15, label: 'Quick' },
  HALF: { questions: 20, minutes: 30, label: 'Half' },
  FULL: { questions: 40, minutes: 60, label: 'Full' },
} as const
export type MockPreset = keyof typeof mockPresets
export type MockScope = 'WHOLE_EXAM' | 'TOPICS' | 'WEAK'
export const extraTimeOptions = [0, 25, 50, 100] as const
export type ExtraTime = (typeof extraTimeOptions)[number]

export const mockBuildSchema = z.object({
  id: z.string(),
  examId: z.string(),
  status: z.enum(['QUEUED', 'RUNNING', 'READY', 'SHORTFALL', 'FAILED', 'CANCELLED']),
  preset: z.enum(['QUICK', 'HALF', 'FULL']),
  scope: z.enum(['WHOLE_EXAM', 'TOPICS', 'WEAK']),
  conditions: z.boolean(),
  requestedCount: z.number(),
  availableCount: z.number(),
  minimumCount: z.number(),
  timeLimitSeconds: z.number(),
  shorterTimeLimitSeconds: z.number().nullable(),
  alternatives: z.array(z.string()).default([]),
  reasonCode: z.string().nullable(),
  retryable: z.boolean(),
  coverage: z
    .array(z.object({ topicId: z.string(), requested: z.number(), supplied: z.number(), shortfallReason: z.string().optional() }))
    .optional(),
})
export type MockBuild = z.infer<typeof mockBuildSchema>

export const mockSittingSchema = z.object({
  sessionId: z.string(),
  buildId: z.string(),
  examId: z.string(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED']),
  conditions: z.boolean(),
  label: z.enum(['EXAM_CONDITIONS', 'PRACTICE_SIMULATION']).optional(),
  deadlineAt: z.string().nullable(),
  serverNow: z.string(),
  extraTimePercent: z.number(),
  itemCount: z.number(),
  navigator: z.array(z.object({ index: z.number(), answered: z.boolean(), flagged: z.boolean() })),
})
export type MockSitting = z.infer<typeof mockSittingSchema>

const mockQuestionSchema = z
  .object({ kind: z.enum(['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'CLOZE', 'MATCHING', 'ORDERING', 'SHORT_ANSWER']), prompt: z.string() })
  .passthrough()

export const mockItemSchema = z.object({
  index: z.number(),
  itemId: z.string(),
  topicId: z.string().nullable().optional(),
  question: mockQuestionSchema,
  draft: z.object({
    answer: z.unknown().nullable(),
    flagged: z.boolean(),
    revision: z.number(),
    savedAt: z.string().nullable(),
  }),
})
export type MockItem = Omit<z.infer<typeof mockItemSchema>, 'question'> & { question: QuestionView }

/** A mock item has no hints, attempts or time of its own: fill the player-view fields so the shared renderers can draw it. */
export function toMockQuestionView(raw: z.infer<typeof mockQuestionSchema>, index: number, itemId: string): QuestionView {
  return {
    itemIndex: index,
    questionId: itemId,
    hintsAvailable: 0,
    sourceLink: null,
    timeLimitSec: null,
    attemptsAllowed: 1,
    attemptNo: 1,
    ...(raw.kind === 'SHORT_ANSWER' ? { maxChars: 1000 } : {}),
    ...raw,
  } as unknown as QuestionView
}

export const mockSaveSchema = z.object({
  index: z.number(),
  itemId: z.string(),
  answer: z.unknown().nullable(),
  flagged: z.boolean(),
  revision: z.number(),
  savedAt: z.string().nullable(),
})
export type MockSave = z.infer<typeof mockSaveSchema>

const resultRowSchema = z.object({ scorePoints: z.number(), itemCount: z.number(), ungradedCount: z.number() })
export const mockResultSchema = z.object({
  sessionId: z.string(),
  examId: z.string(),
  status: z.enum(['FULLY_MARKED', 'PARTLY_MARKED', 'MARKING_PENDING']),
  submittedAt: z.string(),
  scorePercent: z.number().nullable(),
  gradedItemCount: z.number(),
  itemCount: z.number(),
  ungradedItemCount: z.number(),
  passMarkPercent: z.number().nullable(),
  passStatus: z.string().nullable(),
  priorMockPercent: z.number().nullable(),
  readinessDeltaPercent: z.number().nullable(),
  byTopic: z.array(resultRowSchema.extend({ topicId: z.string(), label: z.string() })),
  byKind: z.array(resultRowSchema.extend({ kind: z.string() })),
  findings: z.array(z.unknown()).default([]),
  suggestedActions: z.array(tutorActionSchema).default([]),
  revision: z.number(),
})
export type MockResult = z.infer<typeof mockResultSchema>

export const mockReviewSchema = z.object({
  sessionId: z.string(),
  items: z.array(
    z.object({
      index: z.number(),
      itemId: z.string(),
      question: mockQuestionSchema,
      answer: z.unknown().nullable(),
      correctAnswer: z.unknown().nullable().optional(),
      score: z.number().nullable(),
      gradingStatus: z.string(),
      citations: z.array(sourceCitationSchema).default([]),
    }),
  ),
})
export type MockReview = z.infer<typeof mockReviewSchema>

export const schedulePreviewSchema = z.object({
  id: z.string(),
  baseRevision: z.number(),
  expiresAt: z.string(),
  canApply: z.boolean(),
  changes: z.array(z.object({ itemId: z.string(), from: z.string().nullable(), to: z.string().nullable(), reasonCode: z.string() }).passthrough()),
  conflicts: z.array(z.unknown()).default([]),
  unplacedMinutes: z.number().default(0),
})
export type SchedulePreview = z.infer<typeof schedulePreviewSchema>

/* ---------- short lesson ---------- */

const lessonCardSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('IDEA'), text: z.string(), citation: sourceCitationSchema.nullable().optional() }),
  z.object({ kind: z.literal('EXAMPLE'), text: z.string(), citation: sourceCitationSchema.nullable().optional() }),
  z.object({ kind: z.literal('WATCH_OUT'), text: z.string(), citation: sourceCitationSchema.nullable().optional() }),
  z.object({
    kind: z.literal('CHECK'),
    questionRef: z.string(),
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
])
export type ShortLessonCard = z.infer<typeof lessonCardSchema>

export const shortLessonSchema = z.object({
  id: z.string(),
  formatVersion: z.literal('TUTOR_4'),
  status: z.enum(['QUEUED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED']),
  title: z.string().nullable(),
  cards: z.array(lessonCardSchema),
  reasonCode: z.string().nullable(),
  retryable: z.boolean(),
})
export type ShortLesson = z.infer<typeof shortLessonSchema>

export const lessonCheckSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().nullable().optional(),
  attempt: z.number().optional(),
  correctOptionId: z.string().nullable().optional(),
})
export type LessonCheckResult = z.infer<typeof lessonCheckSchema>
export const lessonCompleteSchema = z.object({ lessonId: z.string(), completedAt: z.string() })

/* ---------- client ---------- */

export function newRequestId(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-8${hex().slice(1)}-${hex()}${hex()}${hex()}`
}

type Opts = Omit<TutorRequestOptions, 'method' | 'body'>
const enc = encodeURIComponent

export const tutorPracticeApi = {
  practice: (goalId: string | null, o?: Opts) => tutorLoopGet('/practice', practiceSchema, { goalId }, o),
  topic: (topicId: string, goalId: string | null, o?: Opts) =>
    tutorLoopGet(`/practice/topics/${enc(topicId)}`, practiceTopicSchema, { goalId }, o),
  createQuestionSet: (body: { clientRequestId: string; topicId: string; kinds: TutorQuestionKind[]; goalId?: string | null; count?: number }, o?: Opts) =>
    tutorLoopPost('/practice/question-sets', questionSetSchema, { ...body, goalId: body.goalId ?? undefined }, o),
  questionSet: (id: string, o?: Opts) => tutorLoopGet(`/practice/question-sets/${enc(id)}`, questionSetSchema, undefined, o),
  item: async (sessionId: string, index: number, o?: Opts): Promise<SessionItem> =>
    (await tutorLoopGet(`/practice/sessions/${enc(sessionId)}/items/${index}`, sessionItemSchema, undefined, o)) as SessionItem,
  hint: (sessionId: string, index: number, o?: Opts) => tutorLoopPost(`/practice/sessions/${enc(sessionId)}/items/${index}/hint`, hintSchema, {}, o),
  answer: (
    sessionId: string,
    index: number,
    body: { clientAttemptId: string; answer: PracticeAnswer; confidence?: Confidence },
    o?: Opts,
  ) => tutorLoopPost(`/practice/sessions/${enc(sessionId)}/items/${index}/answer`, practiceAnswerSchema, body, o),
  finish: (sessionId: string, o?: Opts) => tutorLoopPost(`/practice/sessions/${enc(sessionId)}/finish`, finishSchema, {}, o),
  nextStep: (kind: 'PRACTICE' | 'LESSON', id: string, o?: Opts) => tutorLoopGet(`/activities/${kind}/${enc(id)}/next`, tutorNextStepSchema, undefined, o),

  examPrep: (goalId: string | null, o?: Opts) => tutorLoopGet('/exam-prep', examPrepSchema, { goalId }, o),

  createMockBuild: (
    body: { clientRequestId: string; examId: string; preset: MockPreset; scope: MockScope; conditions: boolean; topicIds?: string[] },
    o?: Opts,
  ) => tutorLoopPost('/mock-builds', mockBuildSchema, body, o),
  mockBuild: (id: string, o?: Opts) => tutorLoopGet(`/mock-builds/${enc(id)}`, mockBuildSchema, undefined, o),
  cancelMockBuild: (id: string, o?: Opts) => tutorLoopPost(`/mock-builds/${enc(id)}/cancel`, mockBuildSchema, {}, o),
  startMock: (id: string, body: { clientRequestId: string; acceptShorter: boolean; extraTimePercent: ExtraTime }, o?: Opts) =>
    tutorLoopPost(`/mock-builds/${enc(id)}/start`, mockSittingSchema, body, o),
  sitting: (sessionId: string, o?: Opts) => tutorLoopGet(`/mock-sittings/${enc(sessionId)}`, mockSittingSchema, undefined, o),
  mockItem: async (sessionId: string, index: number, o?: Opts): Promise<MockItem> => {
    const raw = await tutorLoopGet(`/mock-sittings/${enc(sessionId)}/items/${index}`, mockItemSchema, undefined, o)
    return { ...raw, question: toMockQuestionView(raw.question, raw.index, raw.itemId) }
  },
  saveMockItem: (sessionId: string, index: number, body: { revision: number; answer?: PracticeAnswer | null; flagged?: boolean }, o?: Opts) =>
    tutorLoopPut(`/mock-sittings/${enc(sessionId)}/items/${index}`, mockSaveSchema, body, o),
  submitMock: (sessionId: string, clientRequestId: string, o?: Opts) =>
    tutorLoopPost(`/mock-sittings/${enc(sessionId)}/submit`, mockResultSchema, { clientRequestId }, o),
  mockResult: (sessionId: string, o?: Opts) => tutorLoopGet(`/mock-sittings/${enc(sessionId)}/result`, mockResultSchema, undefined, o),
  mockReview: (sessionId: string, o?: Opts) => tutorLoopGet(`/mock-sittings/${enc(sessionId)}/review`, mockReviewSchema, undefined, o),
  revisionPreview: (sessionId: string, baseRevision: number, o?: Opts) =>
    tutorLoopPost(`/mock-sittings/${enc(sessionId)}/revision-preview`, schedulePreviewSchema, { baseRevision }, o),
  applySchedulePreview: (previewId: string, o?: Opts) =>
    tutorLoopPost(`/schedule/previews/${enc(previewId)}/apply`, z.unknown(), { clientRequestId: newRequestId() }, o),

  createShortLesson: (body: { clientRequestId: string; topicId: string; materialId: string }, o?: Opts) =>
    tutorLoopPost('/lessons', shortLessonSchema, body, o),
  checkLesson: (id: string, optionId: string, o?: Opts) => tutorLoopPost(`/lessons/${enc(id)}/check`, lessonCheckSchema, { optionId }, o),
  completeLesson: (id: string, o?: Opts) => tutorLoopPost(`/lessons/${enc(id)}/complete`, lessonCompleteSchema, {}, o),
  shortLesson: (id: string, o?: Opts) => tutorLoopGet(`/lessons/${enc(id)}`, shortLessonSchema, undefined, o),
}

/* ---------- pure helpers ---------- */

export const questionKindLabels: Record<TutorQuestionKind, string> = {
  MCQ: 'Multiple choice',
  TRUE_FALSE: 'True or false',
  SHORT_ANSWER: 'Short answer',
  ORDERING: 'Put in order',
  CLOZE: 'Fill the gap',
}

/** The one sentence for a failed build or set: closed copy, never model or error text. */
export function generationFailureCopy(reasonCode: string | null | undefined): string {
  if (reasonCode === 'AI_UNAVAILABLE' || reasonCode === 'TUTOR_RESTING') return 'Your tutor is resting, so new questions can not be made right now. You can try again soon.'
  if (reasonCode === 'INSUFFICIENT_MATERIAL') return 'There is not enough material for this yet. Add material and try again.'
  return 'Those questions could not be made. Try again.'
}

export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  const two = (n: number) => String(n).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`
}

/** Seconds left from the server's clock reading, so a wrong device clock never changes the deadline. */
export function secondsLeft(sitting: Pick<MockSitting, 'deadlineAt' | 'serverNow'>, elapsedSinceReadMs: number): number | null {
  if (!sitting.deadlineAt) return null
  const left = (Date.parse(sitting.deadlineAt) - Date.parse(sitting.serverNow) - elapsedSinceReadMs) / 1000
  return Math.max(0, Math.ceil(left))
}
