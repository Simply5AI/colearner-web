import type { TeachingRequestFn } from '@/lib/api/teaching/core'
import { TeachingApiError } from '@/lib/api/teaching/core'
import {
  assignmentFixture, contextFixture, conflict, denied, never, notFound, planDetailFixture, serverError, unavailable,
} from '@/components/teacher/dashboard/dev/fixtures'
import type { StudentVisibility, TeacherOnboardingState, TeacherOnboardingStep } from '@/lib/api/teaching/onboarding'
import { ONBOARDING_STEPS } from '@/lib/api/teaching/onboarding'

type Plan = NonNullable<TeacherOnboardingState['firstPlan']>

const emptyProfile = { displayName: '', bio: null, subjects: [], grades: [], photoStorageKey: null }
const savedProfile = { displayName: 'Daniel Okafor', bio: 'I teach maths.', subjects: ['Mathematics'], grades: [6, 7], photoStorageKey: null }

export interface OnboardingMockOptions {
  state: string
  photo?: boolean
  /** The first PUT /onboarding answers 409 REVISION_CONFLICT. */
  conflict?: boolean
  /** The first POST /assignments fails. */
  assignFail?: boolean
  /** The first POST /materials fails. */
  materialFail?: boolean
}

export interface OnboardingMock {
  request: TeachingRequestFn
  /** Fixture-only control: the teacher published the plan in the editor. */
  publishPlan: () => void
  readonly store: { current: TeacherOnboardingState }
}

function plan(visibility: StudentVisibility, title = 'Class 6 Fractions'): Plan {
  const published = visibility !== 'NOT_PUBLISHED'
  return { planId: 'plan-1', title, status: published ? 'PUBLISHED' : 'DRAFT', publishedAt: published ? '2026-10-22T08:00:00.000Z' : null, studentVisibility: visibility }
}

function initial(scenario: string, photo: boolean): TeacherOnboardingState {
  const base: TeacherOnboardingState = {
    step: 'PROFILE', completed: false, revision: 1, skipped: [], skippable: { MATERIAL: true, INVITE: true },
    profile: emptyProfile,
    activation: { membership: 'ACTIVE', classesAssigned: 2, note: null },
    firstPlan: null, hasMaterial: false,
    assign: { available: true, reason: null, rosterCount: 28 },
    invite: { available: false, reason: 'Invite codes, links and QR codes arrive with the invitations release.' },
    photoUpload: { available: photo, reason: photo ? null : 'File storage is not set up for this school.' },
  }
  const at = (step: TeacherOnboardingStep, visibility: StudentVisibility | null, extra: Partial<TeacherOnboardingState> = {}): TeacherOnboardingState => ({
    ...base, step, profile: savedProfile, firstPlan: visibility ? plan(visibility) : null, revision: 2, ...extra,
  })
  switch (scenario) {
    case 'first-plan': return at('FIRST_PLAN', null)
    case 'first-plan-saved': return at('FIRST_PLAN', 'NOT_PUBLISHED')
    case 'material': return at('MATERIAL', 'NOT_PUBLISHED')
    case 'invite-draft': return at('INVITE', 'NOT_PUBLISHED', { skipped: ['MATERIAL'] })
    case 'invite': return at('INVITE', 'PUBLISHED_NOT_ASSIGNED')
    case 'done-not-published': return at('DONE', 'NOT_PUBLISHED')
    case 'done-published': return at('DONE', 'PUBLISHED_NOT_ASSIGNED')
    case 'done-pending': return at('DONE', 'ASSIGNED_PENDING_APPROVAL')
    case 'done-live': return at('DONE', 'ASSIGNED')
    case 'done-complete': return at('DONE', 'ASSIGNED', { completed: true })
    case 'no-class': return at('FIRST_PLAN', null, { activation: { membership: 'ACTIVE', classesAssigned: 0, note: 'No class is assigned yet. Ask your school administrator.' }, assign: { available: false, reason: 'No class is assigned to you yet.', rosterCount: null } })
    default: return base
  }
}

/** Stateful stand-in for contract 6.8 plus the few plan routes the embedded W2 components call. */
export function createOnboardingMock(options: OnboardingMockOptions): OnboardingMock {
  const store = { current: initial(options.state, options.photo ?? true) }
  let reads = 0
  let conflictSpent = false
  let assignSpent = false
  let materialSpent = false
  const bump = (patch: Partial<TeacherOnboardingState>) => {
    store.current = { ...store.current, ...patch, revision: store.current.revision + 1 }
  }
  const request = (async (suffix: string, method = 'GET', body?: unknown) => {
    const input = (body ?? {}) as Record<string, unknown>
    if (suffix === '/onboarding' && method === 'GET') {
      reads += 1
      if (options.state === 'loading') return never()
      if (options.state === 'denied') throw denied()
      if (options.state === 'unavailable') throw unavailable()
      if (options.state === 'retry' && reads === 1) throw serverError()
      if (options.state === 'malformed') return { step: 'PROFILE' }
      return store.current
    }
    if (suffix === '/onboarding' && method === 'PUT') {
      if (options.conflict && !conflictSpent) {
        conflictSpent = true
        throw conflict()
      }
      if (input.expectedRevision !== store.current.revision) throw conflict()
      const step = input.step as TeacherOnboardingStep | undefined
      if (step) {
        if (ONBOARDING_STEPS.indexOf(step) < ONBOARDING_STEPS.indexOf(store.current.step)) throw new TeachingApiError(400, 'Steps only move forward.', 'STEP_BACKWARDS')
        if (step === 'INVITE' && !store.current.firstPlan) throw new TeachingApiError(400, 'Create a plan first.', 'PLAN_REQUIRED')
      }
      const profile = input.profile as Partial<TeacherOnboardingState['profile']> | undefined
      bump({ ...(step ? { step } : {}), ...(profile ? { profile: { ...store.current.profile, ...profile } } : {}) })
      return store.current
    }
    if (suffix === '/onboarding/skip') {
      const step = input.step as 'MATERIAL' | 'INVITE'
      if (step !== 'MATERIAL' && step !== 'INVITE') throw new TeachingApiError(400, 'Not skippable.', 'SKIP_NOT_ALLOWED')
      bump({ step: step === 'MATERIAL' ? 'INVITE' : 'DONE', skipped: [...store.current.skipped, step] })
      return store.current
    }
    if (suffix === '/onboarding/complete') {
      if (!store.current.firstPlan) throw new TeachingApiError(409, 'Create a plan first.', 'PLAN_REQUIRED')
      bump({ step: 'DONE', completed: true })
      return { nextRoute: '/teacher/dashboard', state: store.current }
    }
    if (suffix === '/onboarding/photo-upload-url') return { uploadUrl: 'https://fixture-storage.invalid/photo', storageKey: 'teacher-photos/org/user/photo-1', expiresIn: 300 }
    if (suffix === '/context') return contextFixture({ noClass: store.current.activation.classesAssigned === 0, photo: options.photo ?? true })
    if (suffix === '/plans' && method === 'POST') {
      const created = plan('NOT_PUBLISHED', String(input.title ?? 'New plan'))
      bump({ firstPlan: created })
      return planDetailFixture('plan-1', 'DRAFT', { title: created.title })
    }
    const topic = /^\/plans\/plan-1\/topics\/topic-1\/materials(\/upload-url)?$/.exec(suffix)
    if (topic && method === 'POST') {
      if (topic[1]) return { uploadUrl: 'https://fixture-storage.invalid/material', storageKey: 'plan-materials/org/plan-1/topic-1/file-1', expiresIn: 300 }
      if (options.materialFail && !materialSpent) {
        materialSpent = true
        throw serverError()
      }
      bump({ hasMaterial: true })
      return { id: 'material-1', topicId: 'topic-1', type: input.type, title: input.title, status: 'DRAFT' }
    }
    const assignments = /^\/plans\/plan-1\/assignments$/.exec(suffix)
    if (assignments) {
      if (method === 'GET') return { items: [] }
      if (options.assignFail && !assignSpent) {
        assignSpent = true
        throw serverError()
      }
      bump({ firstPlan: plan('ASSIGNED_PENDING_APPROVAL', store.current.firstPlan?.title) })
      return assignmentFixture('plan-1', String(input.classId ?? 'class-6a'))
    }
    if (suffix === '/plans/plan-1') {
      const current = store.current.firstPlan
      return planDetailFixture('plan-1', current?.status ?? 'DRAFT', { title: current?.title, visibility: current?.studentVisibility })
    }
    throw notFound()
  }) as TeachingRequestFn
  return {
    request,
    store,
    publishPlan: () => bump({ firstPlan: plan('PUBLISHED_NOT_ASSIGNED', store.current.firstPlan?.title) }),
  }
}
