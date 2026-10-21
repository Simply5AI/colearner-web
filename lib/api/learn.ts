import { z } from 'zod'
import { learnRequest } from './learn-request'

/*
 * B07 learn contract (platform <-> web), 19 October 2026. Until the portable
 * @colearner/api-client tarball ships the matching types, these local interfaces
 * mirror the contract and every Zod schema below must `satisfies` them.
 * A null field means "hide the widget": the UI never invents a value.
 */
export type ApiBand = '6-9' | '10-13' | '14-17'
export type LearnBand = 'kids' | 'tweens' | 'teens'
export const bandFromApi = (band: ApiBand): LearnBand => band === '6-9' ? 'kids' : band === '10-13' ? 'tweens' : 'teens'

export type AiState<T> =
  | { status: 'UNAVAILABLE'; reason: string }
  | { status: 'AVAILABLE'; items: T[]; generatedAt: string; promptRelease: string }

/** HOME is produced only by the lesson completion (B08). */
export type LinkRoute = 'PLAN' | 'LIBRARY_ITEM' | 'IMPORT' | 'SNAP' | 'LESSON' | 'PRACTICE' | 'ASSIGNMENT' | 'HOME'
/** B09: what a PRACTICE link opens (HUB = the practice hub; DUE = review everything due; SET = a generated question set). */
export type PracticeScope = 'HUB' | 'DUE' | 'MATERIAL' | 'LESSON' | 'TOPIC' | 'PLAN_EXAM' | 'SET'
export const practiceScopes = ['HUB', 'DUE', 'MATERIAL', 'LESSON', 'TOPIC', 'PLAN_EXAM', 'SET'] as const satisfies readonly PracticeScope[]
export interface Link { route: LinkRoute; id: string | null; planId?: string | null; /** B08: the plan item a lesson was opened from; forwarded to the lesson start page. */ planItemId?: string | null; /** B09: only on PRACTICE links. */ scope?: PracticeScope | null }
export interface Actionable { link: Link | null; enabled: boolean; disabledReason: string | null }
export interface Progress { done: number; total: number }

export interface NextAction extends Actionable {
  kind: 'CONTINUE_LESSON' | 'DUE_REVIEW' | 'ASSIGNMENT' | 'START_PLAN' | 'IMPORT_MATERIAL'
  title: string; subtitle: string | null; dueAt: string | null
  estimatedMinutes: number | null; progress: Progress | null
  origin: 'ASSIGNED' | 'SCHEDULED' | 'PERSONAL' | 'SYSTEM'
}
export interface TodayItem extends Actionable { kind: 'REVIEW' | 'LESSON' | 'QUIZ'; title: string; estimatedMinutes: number | null }
export interface HomeAssignment { planId: string; title: string; teacherName: string | null; className: string | null; dueAt: string | null; progress: Progress; link: Link }
export interface SubjectProgress { subjectId: string; name: string; itemsDone: number; itemsTotal: number; masteryPercent: number | null }
export interface RecentMaterial { id: string; title: string; status: string; sourceType: string; updatedAt: string }
export interface Recommendation { title: string; reason: string; link: Link }
export interface LearnHome {
  band: ApiBand
  learner: { displayName: string }
  state: 'FIRST_TIME' | 'ACTIVE' | 'LIMIT_REACHED'
  nextAction: NextAction | null
  todayPlan: { estimatedMinutes: number | null; items: TodayItem[] } | null
  assignments: HomeAssignment[]
  dueReviewCount: number
  streak: { currentDays: number } | null
  timeBudget: { minutesLeftToday: number } | null
  subjectProgress: SubjectProgress[]
  examCountdown: { label: string; examDate: string; daysLeft: number } | null
  recentMaterials: RecentMaterial[]
  recommendation: AiState<Recommendation>
}

export interface PlanCard {
  id: string; kind: 'PERSONAL' | 'ASSIGNED'; title: string
  subject: { id: string; name: string } | null
  mode: 'TOPIC' | 'SYLLABUS' | 'EXAM_PREP'; status: 'ACTIVE' | 'COMPLETED'
  progress: Progress; nextItemTitle: string | null; dueAt: string | null; examDate: string | null
  assignedBy: { name: string } | null; className: string | null
  locked: boolean
}
export interface PendingEnrollment { id: string; planTitle: string; teacherName: string | null; status: 'PENDING_GUARDIAN_APPROVAL'; requestedAt: string }
export interface OverviewSubject { id: string; name: string; icon: string | null; planCount: number; progress: Progress }
export interface LearnOverview {
  band: ApiBand
  subjects: OverviewSubject[]
  plans: PlanCard[]
  pendingEnrollments: PendingEnrollment[]
  canJoinWithCode: boolean; canCreatePersonalPlan: boolean; unavailableReason: string | null
  nextCursor: string | null
}
export interface OverviewFilters { q?: string; subjectId?: string; kind?: 'PERSONAL' | 'ASSIGNED'; status?: 'ACTIVE' | 'COMPLETED' | 'PENDING_APPROVAL' }

export interface JoinResult { status: 'ENROLLED' | 'PENDING_GUARDIAN_APPROVAL'; enrollmentId: string; planId: string | null }

export type ItemStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
export type TopicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
export type MaterialOrigin = 'PERSONAL' | 'TEACHER' | 'CENTRAL'
export interface PlanItem extends Actionable { id: string; kind: 'LESSON' | 'PRACTICE' | 'QUIZ' | 'MOCK_TEST'; title: string; status: ItemStatus }
export interface PlanTopic {
  id: string; title: string; status: TopicStatus; masteryPercent: number | null; dueAt: string | null
  items: PlanItem[]
  materials: { id: string; title: string; sourceType: string; origin: MaterialOrigin }[]
}
export interface PlanPhase { id: string; title: string; ordinal: number; progress: Progress; topics: PlanTopic[] }
export interface PlanMaterial { id: string; title: string; sourceType: string; origin: MaterialOrigin; link: Link }
export interface SuggestedResource { title: string; url: string | null; reason: string }
export interface PlanDetail {
  /** The age band the server resolved for this learner (added to the contract at B07 integration). */
  band: ApiBand
  plan: PlanCard & { teacherNote: string | null }
  nextItemId: string | null
  phases: PlanPhase[]
  weakConcepts: { conceptId: string; name: string }[]
  materials: PlanMaterial[]
  suggestedResources: AiState<SuggestedResource>
  permissions: { canEditStructure: boolean; canAttachMaterial: boolean; canStartNext: boolean; lockedReason: string | null }
}

const id = z.string().min(1).max(256)
const text = z.string().max(2000)
const count = z.number().int().nonnegative()
const iso = z.string().min(1)
const band = z.enum(['6-9', '10-13', '14-17'])
const progress = z.object({ done: count, total: count }) satisfies z.ZodType<Progress>
const link = z.object({
  route: z.enum(['PLAN', 'LIBRARY_ITEM', 'IMPORT', 'SNAP', 'LESSON', 'PRACTICE', 'ASSIGNMENT', 'HOME']),
  id: id.nullable(), planId: id.nullish(), planItemId: id.nullish(), scope: z.enum(practiceScopes).nullish(),
}) satisfies z.ZodType<Link>
/** Shared by the lesson and practice contracts so a PRACTICE link keeps its scope everywhere. */
export const linkSchema = link
const actionable = { link: link.nullable(), enabled: z.boolean(), disabledReason: text.nullable() }
const aiState = <T extends z.ZodType>(item: T) => z.discriminatedUnion('status', [
  z.object({ status: z.literal('UNAVAILABLE'), reason: text }),
  z.object({ status: z.literal('AVAILABLE'), items: z.array(item), generatedAt: iso, promptRelease: z.string() }),
])

const nextAction = z.object({
  ...actionable,
  kind: z.enum(['CONTINUE_LESSON', 'DUE_REVIEW', 'ASSIGNMENT', 'START_PLAN', 'IMPORT_MATERIAL']),
  title: text, subtitle: text.nullable(), dueAt: iso.nullable(), estimatedMinutes: count.nullable(), progress: progress.nullable(),
  origin: z.enum(['ASSIGNED', 'SCHEDULED', 'PERSONAL', 'SYSTEM']),
}) satisfies z.ZodType<NextAction>
const subjectProgress = z.object({ subjectId: id, name: text, itemsDone: count, itemsTotal: count, masteryPercent: z.number().min(0).max(100).nullable() }) satisfies z.ZodType<SubjectProgress>
export const learnHomeSchema = z.object({
  band, learner: z.object({ displayName: text }),
  state: z.enum(['FIRST_TIME', 'ACTIVE', 'LIMIT_REACHED']),
  nextAction: nextAction.nullable(),
  todayPlan: z.object({ estimatedMinutes: count.nullable(), items: z.array(z.object({ ...actionable, kind: z.enum(['REVIEW', 'LESSON', 'QUIZ']), title: text, estimatedMinutes: count.nullable() })) }).nullable(),
  assignments: z.array(z.object({ planId: id, title: text, teacherName: text.nullable(), className: text.nullable(), dueAt: iso.nullable(), progress, link })),
  dueReviewCount: count,
  streak: z.object({ currentDays: count }).nullable(),
  timeBudget: z.object({ minutesLeftToday: count }).nullable(),
  subjectProgress: z.array(subjectProgress),
  examCountdown: z.object({ label: text, examDate: iso, daysLeft: z.number().int() }).nullable(),
  recentMaterials: z.array(z.object({ id, title: text, status: z.string(), sourceType: z.string(), updatedAt: iso })),
  recommendation: aiState(z.object({ title: text, reason: text, link })),
}) satisfies z.ZodType<LearnHome>

const planCard = z.object({
  id, kind: z.enum(['PERSONAL', 'ASSIGNED']), title: text,
  subject: z.object({ id, name: text }).nullable(),
  mode: z.enum(['TOPIC', 'SYLLABUS', 'EXAM_PREP']), status: z.enum(['ACTIVE', 'COMPLETED']),
  progress, nextItemTitle: text.nullable(), dueAt: iso.nullable(), examDate: iso.nullable(),
  assignedBy: z.object({ name: text }).nullable(), className: text.nullable(), locked: z.boolean(),
}) satisfies z.ZodType<PlanCard>
export const learnOverviewSchema = z.object({
  band,
  subjects: z.array(z.object({ id, name: text, icon: z.string().max(64).nullable(), planCount: count, progress })),
  plans: z.array(planCard),
  pendingEnrollments: z.array(z.object({ id, planTitle: text, teacherName: text.nullable(), status: z.literal('PENDING_GUARDIAN_APPROVAL'), requestedAt: iso })),
  canJoinWithCode: z.boolean(), canCreatePersonalPlan: z.boolean(), unavailableReason: text.nullable(),
  nextCursor: z.string().max(1024).nullable(),
}) satisfies z.ZodType<LearnOverview>

export const joinResultSchema = z.object({ status: z.enum(['ENROLLED', 'PENDING_GUARDIAN_APPROVAL']), enrollmentId: id, planId: id.nullable() }) satisfies z.ZodType<JoinResult>

const itemStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'SKIPPED'])
const topicStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE'])
const origin = z.enum(['PERSONAL', 'TEACHER', 'CENTRAL'])
export const planDetailSchema = z.object({
  band,
  // A teacher's note is free text of arbitrary length, so it is not capped like titles and names.
  plan: planCard.extend({ teacherNote: z.string().nullable() }),
  nextItemId: id.nullable(),
  phases: z.array(z.object({
    id, title: text, ordinal: count, progress,
    topics: z.array(z.object({
      id, title: text, status: topicStatus, masteryPercent: z.number().min(0).max(100).nullable(), dueAt: iso.nullable(),
      items: z.array(z.object({ ...actionable, id, kind: z.enum(['LESSON', 'PRACTICE', 'QUIZ', 'MOCK_TEST']), title: text, status: itemStatus })),
      materials: z.array(z.object({ id, title: text, sourceType: z.string(), origin })),
    })),
  })),
  weakConcepts: z.array(z.object({ conceptId: id, name: text })),
  materials: z.array(z.object({ id, title: text, sourceType: z.string(), origin, link })),
  suggestedResources: aiState(z.object({ title: text, url: z.string().max(2048).nullable(), reason: text })),
  permissions: z.object({ canEditStructure: z.boolean(), canAttachMaterial: z.boolean(), canStartNext: z.boolean(), lockedReason: text.nullable() }),
}) satisfies z.ZodType<PlanDetail>

const resourceId = /^[a-zA-Z0-9_-]{1,128}$/

/**
 * Real web routes for server links. The lesson route exists since B08 (it starts or resumes the lesson for the
 * material id). Practice (B09): HUB, and DUE without an id, open the hub; MATERIAL, LESSON, TOPIC, PLAN_EXAM and SET
 * open the start page, which creates or finds the question set and then the session. A PRACTICE link without a scope
 * and an id is not guessed at: it resolves to null and the UI shows the server's reason.
 */
export function linkHref(target: Link | null | undefined): string | null {
  if (!target) return null
  const safe = (value: string | null | undefined) => value && resourceId.test(value) ? encodeURIComponent(value) : null
  switch (target.route) {
    case 'PLAN': { const planId = safe(target.id); return planId ? `/learn/plans/${planId}` : null }
    case 'LIBRARY_ITEM': { const itemId = safe(target.id); return itemId ? `/learn/library/${itemId}` : null }
    case 'HOME': return '/learn/home'
    case 'IMPORT': return '/learn/import'
    case 'SNAP': return '/learn/snap'
    case 'LESSON': {
      const materialId = safe(target.id)
      if (!materialId) return null
      const planItemId = safe(target.planItemId)
      return `/learn/lesson/new?materialId=${materialId}${planItemId ? `&planItemId=${planItemId}` : ''}`
    }
    case 'ASSIGNMENT': { const planId = safe(target.planId ?? target.id); return planId ? `/learn/plans/${planId}` : null }
    case 'PRACTICE': return practiceHref(target, safe)
    default: return null
  }
}

function practiceHref(target: Link, safe: (value: string | null | undefined) => string | null): string | null {
  const scope = target.scope ?? (target.id === null ? 'HUB' : null)
  if (scope === 'HUB') return target.id === null ? '/learn/practice' : null
  if (scope === 'DUE') return target.id === null ? '/learn/practice' : null
  if (!scope) return null
  const id = safe(target.id)
  if (!id) return null
  const planId = safe(target.planId)
  return `/learn/practice/start?scope=${scope}&id=${id}${planId ? `&planId=${planId}` : ''}`
}

/** Only absolute http(s) addresses may leave the product from a suggested resource. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null } catch { return null }
}

export function overviewQuery(filters: OverviewFilters, cursor?: string | null) {
  const params = new URLSearchParams({ limit: '20' })
  // The server rejects a search longer than 100 characters, so one is never sent.
  const search = filters.q?.trim().slice(0, 100).trim()
  if (search) params.set('q', search)
  if (filters.subjectId) params.set('subjectId', filters.subjectId)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.status) params.set('status', filters.status)
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

export const learnApi = {
  home: () => learnRequest('/home', learnHomeSchema),
  overview: (filters: OverviewFilters, cursor?: string | null) => learnRequest(`/overview?${overviewQuery(filters, cursor)}`, learnOverviewSchema),
  plan: (planId: string) => learnRequest(`/plans/${encodeURIComponent(planId)}`, planDetailSchema),
  join: (code: string) => learnRequest('/enrollments/join', joinResultSchema, 'POST', { code: code.trim() }),
}
