'use client'

import { z } from 'zod'
import { ApiError } from './client'

/**
 * B07 / A6 "Meet Co" client. Local boundary schemas written to
 * `Learning App Redesign/Implementation Plan/agents/contracts/B07-contracts.md`
 * until the portable `@colearner/api-client` types land.
 */
export const onboardingSteps = ['HELLO', 'CONTEXT', 'SUBJECTS', 'PERSONALISE', 'FIRST_IMPORT'] as const
export type OnboardingStep = (typeof onboardingSteps)[number]
export type ApiBand = '6-9' | '10-13' | '14-17'
export type OnboardingBand = 'kids' | 'tweens' | 'teens'
export const bandOf: Record<ApiBand, OnboardingBand> = { '6-9': 'kids', '10-13': 'tweens', '14-17': 'teens' }

export type CoPresence = 'AVATAR' | 'MINIMAL' | 'HIDDEN'
export interface OnboardingDraft {
  contexts: 'SCHOOL'[]
  board: 'CBSE' | 'ICSE' | null
  grade: number | null
  subjectIds: string[]
  customSubjects: string[]
  goal: string | null
  examDate: string | null
  coTheme: string | null
  coNickname: string | null
  coPresence: CoPresence | null
  voiceEnabled: boolean | null
}
export type AiState<T> =
  | { status: 'UNAVAILABLE'; reason: string }
  | { status: 'AVAILABLE'; items: T[]; generatedAt: string; promptRelease: string }
export interface OnboardingState {
  band: ApiBand
  step: OnboardingStep
  completed: boolean
  draft: OnboardingDraft
  preload: { board: 'CBSE' | 'ICSE'; grade: number; className: string | null; source: 'SCHOOL_ROSTER' } | null
  curriculumSubjects: { subjectId: string; name: string }[]
  skipAllowed: boolean
  goalSuggestions: AiState<{ text: string }>
}

const id = z.string().min(1)
const board = z.enum(['CBSE', 'ICSE'])
const aiState = <T extends z.ZodType>(item: T) => z.discriminatedUnion('status', [
  z.object({ status: z.literal('UNAVAILABLE'), reason: z.string() }),
  z.object({ status: z.literal('AVAILABLE'), items: z.array(item), generatedAt: z.string(), promptRelease: z.string() }),
])
export const draftSchema = z.object({
  contexts: z.array(z.literal('SCHOOL')),
  board: board.nullable(),
  grade: z.number().int().min(1).max(10).nullable(),
  subjectIds: z.array(id),
  customSubjects: z.array(z.string()),
  goal: z.string().nullable(),
  examDate: z.string().nullable(),
  coTheme: z.string().nullable(),
  coNickname: z.string().nullable(),
  coPresence: z.enum(['AVATAR', 'MINIMAL', 'HIDDEN']).nullable(),
  voiceEnabled: z.boolean().nullable(),
}) satisfies z.ZodType<OnboardingDraft>
export const onboardingStateSchema = z.object({
  band: z.enum(['6-9', '10-13', '14-17']),
  step: z.enum(onboardingSteps),
  completed: z.boolean(),
  draft: draftSchema,
  preload: z.object({ board, grade: z.number().int().min(1).max(10), className: z.string().nullable(), source: z.literal('SCHOOL_ROSTER') }).nullable(),
  curriculumSubjects: z.array(z.object({ subjectId: id, name: z.string() })),
  skipAllowed: z.boolean(),
  goalSuggestions: aiState(z.object({ text: z.string() })),
}) satisfies z.ZodType<OnboardingState>

/** Draft values we are willing to send. Stricter than what we accept back. */
export const nicknamePattern = /^[\p{L}\p{N}][\p{L}\p{N} '’-]{0,19}$/u
// Mirrors the platform: letters, numbers and simple punctuation (no '+'), at most five own subjects.
export const customSubjectPattern = /^[\p{L}\p{N}][\p{L}\p{N} &'’.,()-]{1,39}$/u
export const maxCustomSubjects = 5
export const maxSubjectIds = 20
/** The platform stores the exam date as a calendar date (YYYY-MM-DD), not an instant. */
export const examDatePattern = /^\d{4}-\d{2}-\d{2}$/
export const maxGoalLength = 140
const outboundDraft = z.object({
  contexts: z.array(z.literal('SCHOOL')).max(1),
  board: board.nullable(),
  grade: z.number().int().min(1).max(10).nullable(),
  subjectIds: z.array(z.string().uuid()).max(maxSubjectIds),
  customSubjects: z.array(z.string().regex(customSubjectPattern)).max(maxCustomSubjects),
  goal: z.string().trim().min(1).max(maxGoalLength).nullable(),
  examDate: z.string().regex(examDatePattern).nullable(),
  coTheme: z.enum(['sunrise', 'ocean', 'galaxy', 'leaf']).nullable(),
  coNickname: z.string().regex(nicknamePattern).nullable(),
  coPresence: z.enum(['AVATAR', 'MINIMAL', 'HIDDEN']).nullable(),
  voiceEnabled: z.boolean().nullable(),
}).partial().strict()
export const saveOnboardingSchema = z.object({ step: z.enum(onboardingSteps), draft: outboundDraft }).strict()
export interface SaveOnboarding { step: OnboardingStep; draft: Partial<OnboardingDraft> }
export const completeSchema = z.object({ nextRoute: z.enum(['IMPORT', 'HOME']) })
export type CompleteResult = z.infer<typeof completeSchema>

export type OnboardingFailure = 'denied' | 'unavailable' | 'session' | 'invalid' | 'conflict' | 'skip-not-allowed'
export class OnboardingError extends ApiError {
  constructor(status: number, message: string, readonly code?: string) { super(status, message) }
  get failure(): OnboardingFailure {
    if (this.code === 'SKIP_NOT_ALLOWED') return 'skip-not-allowed'
    if (this.status === 401) return 'session'
    if (this.status === 403 || this.status === 404) return 'denied'
    if (this.status === 400 || this.status === 422) return 'invalid'
    if (this.status === 409) return 'conflict'
    return 'unavailable'
  }
}
/** Avoid the account-only global sign-out handler for a revoked opaque child session. */
export class OnboardingSessionError extends Error { readonly status = 401 }

/** Contract error codes with copy of our own; the server text itself is never shown. */
const codeMessages: Record<string, string> = {
  CHILD_PROFILE_REQUIRED: 'Your school profile is not linked yet. Ask your school to finish setting it up, then come back.',
  CONSENT_REQUIRED: 'A grown-up needs to say yes before you can start. Ask them to check your settings.',
  AGE_OUT_OF_SCOPE: 'Setup is not available for this age yet.',
  SCHOOL_REQUIRED: 'Your school workspace is not active. Ask your school for help.',
  VOICE_NOT_PERMITTED: 'Voice is turned off by your school or grown-up, so it cannot be switched on.',
  EXAM_DATE_OUT_OF_RANGE: 'Choose an exam date from today up to three years ahead.',
  UNKNOWN_SUBJECT: 'One of those subjects is not available any more. Reload and pick again.',
  FIELD_LOCKED: 'That choice is set by your school or grown-up and cannot be changed here.',
  FIELD_NOT_ALLOWED_FOR_BAND: 'That choice is not available for you.',
  ALREADY_COMPLETED: 'Setup is already finished. Go to Home to carry on.',
  ONBOARDING_INCOMPLETE: 'Finish the setup steps first.',
}
const messages: Record<number, string> = {
  400: 'Check your choices and try again. They are still here.',
  403: 'This learner or action is not allowed by the current school and grown-up settings.',
  404: 'Setup is not available for this learner.',
  409: 'Your setup changed somewhere else. Refresh to see the latest, then try again.',
  422: 'Check your choices and try again. They are still here.',
  429: 'Too many tries. Wait a moment, then try again.',
}
export const skipNotAllowedMessage = 'Skipping is not available here. Let’s finish these steps together.'
const unavailable = 'Setup is unavailable right now. Your choices are still here; try again.'

type Method = 'GET' | 'PUT' | 'POST'
async function onboardingRequest<T>(path: string, schema: z.ZodType<T>, method: Method = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/onboarding${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
  } catch { throw new OnboardingError(503, unavailable) }
  const text = await response.text().catch(() => '')
  let json: unknown = null
  if (text) { try { json = JSON.parse(text) } catch { json = null } }
  if (!response.ok) {
    const record = json && typeof json === 'object' ? json as Record<string, unknown> : {}
    const code = typeof record.code === 'string' ? record.code : undefined
    if (response.status === 401) throw new OnboardingSessionError('Your learning session has ended. Check learner access to continue. Your choices are still here.')
    if (code === 'SKIP_NOT_ALLOWED') throw new OnboardingError(response.status, skipNotAllowedMessage, code)
    throw new OnboardingError(response.status, (code ? codeMessages[code] : undefined) ?? messages[response.status] ?? unavailable, code)
  }
  const data = json !== null && typeof json === 'object' && 'data' in json ? (json as { data: unknown }).data : json
  const result = schema.safeParse(data)
  if (!result.success) throw new OnboardingError(502, 'Setup returned something we could not read. Please try again later.')
  return result.data
}
/** Failure kind that works for both typed errors and the child-safe session error. */
export function failureOf(error: unknown): OnboardingFailure {
  if (error instanceof OnboardingError) return error.failure
  if (error instanceof OnboardingSessionError) return 'session'
  return 'unavailable'
}

export const onboardingApi = {
  get: () => onboardingRequest('', onboardingStateSchema),
  /** Merge-and-idempotent: retrying the same body cannot duplicate anything. */
  save: (input: SaveOnboarding) => {
    const body = saveOnboardingSchema.safeParse(input)
    if (!body.success) return Promise.reject(new OnboardingError(400, messages[400]!))
    return onboardingRequest('', z.unknown(), 'PUT', body.data)
  },
  /** `LATER` tells the server the learner chose to bring material later, so it answers HOME even with an empty library. */
  complete: (firstImport?: 'NOW' | 'LATER') => onboardingRequest('/complete', completeSchema, 'POST', firstImport ? { firstImport } : {}),
  skip: () => onboardingRequest('/skip', z.unknown(), 'POST', {}),
}

export const examDateToApi = (value: string) => (examDatePattern.test(value) ? value : null)
export const examDateToInput = (value: string | null) => (value ? value.slice(0, 10) : '')
export const nextRouteHref = (route: CompleteResult['nextRoute']) => (route === 'IMPORT' ? '/learn/import' : '/learn/home')
