import { z } from 'zod'

export const tutorIconSchema = z.enum(['BUDDY', 'CLOUD', 'SPARK', 'SPROUT'])
export type TutorIcon = z.infer<typeof tutorIconSchema>

export const tutorStyleSchema = z.enum(['FRIENDLY', 'TO_THE_POINT', 'DETAILED', 'CHALLENGING'])
export type TutorStyle = z.infer<typeof tutorStyleSchema>

export const tutorPresenceSchema = z.enum(['AVAILABLE', 'QUIET'])
export type TutorPresence = z.infer<typeof tutorPresenceSchema>

export const tutorQuickActionSchema = z.enum([
  'EXPLAIN',
  'QUIZ',
  'HOMEWORK',
  'BRIEF',
  'CLARIFY',
  'TODAY',
])
export type TutorQuickAction = z.infer<typeof tutorQuickActionSchema>

export const tutorTextScaleSchema = z.enum(['NORMAL', 'LARGE', 'EXTRA_LARGE'])
export type TutorTextScale = z.infer<typeof tutorTextScaleSchema>

export const tutorNudgeKindSchema = z.enum([
  'FIRST_WRONG',
  'REPEATED_WRONG',
  'LESSON_DONE',
  'RETURNED',
  'EXAM_NEAR',
  'READINESS_CHANGED',
  'STUCK',
])
export type TutorNudgeKind = z.infer<typeof tutorNudgeKindSchema>

export const tutorAccessibilitySchema = z.object({
  textScale: tutorTextScaleSchema,
  easyRead: z.boolean(),
  reducedMotion: z.boolean(),
  readAloud: z.boolean(),
})
export type TutorAccessibility = z.infer<typeof tutorAccessibilitySchema>

export const tutorProfileSchema = z.object({
  revision: z.number().int().nonnegative(),
  name: z.string(),
  icon: tutorIconSchema,
  style: tutorStyleSchema,
  presence: tutorPresenceSchema,
  nudgesEnabled: z.boolean(),
  pinnedActions: z.array(tutorQuickActionSchema).max(4),
  memoryOptIn: z.boolean(),
  generalOptOut: z.boolean(),
  accessibility: tutorAccessibilitySchema,
})
export type TutorProfile = z.infer<typeof tutorProfileSchema>

export interface TutorProfilePatch {
  revision: number
  name?: string | null
  icon?: TutorIcon
  style?: TutorStyle
  presence?: TutorPresence
  nudgesEnabled?: boolean
  pinnedActions?: TutorQuickAction[]
  memoryOptIn?: boolean
  generalOptOut?: boolean
  accessibility?: Partial<TutorAccessibility>
}

export const tutorStudyPreferencesSchema = z.object({
  revision: z.number().int().nonnegative(),
  timeZone: z.string().min(1),
  studyDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  minutesPerDay: z.number().int().min(5).max(240),
})
export type TutorStudyPreferences = z.infer<typeof tutorStudyPreferencesSchema>

export interface StudyPreferencesPreviewInput {
  revision: number
  timeZone?: string
  studyDays?: number[]
  minutesPerDay?: number
}

export const scheduleChangeSchema = z.object({
  itemId: z.string(),
  from: z.string(),
  to: z.string(),
  reasonCode: z.string(),
})

export const scheduleConflictSchema = z.object({
  itemId: z.string(),
  reasonCode: z.string(),
})

export const tutorSchedulePreviewSchema = z.object({
  id: z.string(),
  baseRevision: z.number().int().nonnegative(),
  expiresAt: z.string(),
  canApply: z.boolean(),
  changes: z.array(scheduleChangeSchema),
  conflicts: z.array(scheduleConflictSchema),
  unplacedMinutes: z.number().int().nonnegative(),
})
export type TutorSchedulePreview = z.infer<typeof tutorSchedulePreviewSchema>

export const scheduleAppliedSchema = z.object({
  previewId: z.string(),
  revision: z.number().int().nonnegative(),
  appliedAt: z.string(),
})
export type TutorScheduleApplied = z.infer<typeof scheduleAppliedSchema>

export const tutorMemoryFactSchema = z.object({
  id: z.string(),
  kind: z.string(),
  statement: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  source: z.string(),
  conceptRef: z.string().nullable(),
  subjectRef: z.string().nullable(),
  evidence: z.array(
    z.object({
      kind: z.string(),
      id: z.string(),
    }),
  ),
  lastConfirmedAt: z.string(),
  expiresAt: z.string().nullable(),
  revision: z.number().int().nonnegative(),
})
export type TutorMemoryFact = z.infer<typeof tutorMemoryFactSchema>

export const tutorMemoryResponseSchema = z.object({
  enabled: z.boolean(),
  visibleToLinkedParent: z.boolean(),
  facts: z.array(tutorMemoryFactSchema),
})
export type TutorMemoryResponse = z.infer<typeof tutorMemoryResponseSchema>

export const tutorForgottenSchema = z.object({
  forgotten: z.literal(true),
  epoch: z.number().int().nonnegative(),
})
export type TutorForgottenResponse = z.infer<typeof tutorForgottenSchema>

export const adultConsentRevokedSchema = z.object({
  state: z.literal('REVOKED'),
  revokedAt: z.string(),
  revision: z.number().int().nonnegative(),
})
export type AdultConsentRevokedResponse = z.infer<typeof adultConsentRevokedSchema>

export class TutorLoopApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'TutorLoopApiError'
  }
}

export const TUTOR_ICONS: readonly {
  value: TutorIcon
  label: string
  src: string
}[] = [
  { value: 'SPROUT', label: 'Sprout', src: '/tutor-loop/sprout-idle.svg' },
  { value: 'BUDDY', label: 'Buddy', src: '/tutor-loop/buddy-idle.svg' },
  { value: 'SPARK', label: 'Spark', src: '/tutor-loop/spark-idle.svg' },
  { value: 'CLOUD', label: 'Cloud', src: '/tutor-loop/cloud-idle.svg' },
] as const

export const TUTOR_STYLES: readonly {
  value: TutorStyle
  label: string
  subtitle: string
  teenSample: string
  adultSample: string
}[] = [
  {
    value: 'FRIENDLY',
    label: 'Friendly',
    subtitle: 'Warm and encouraging',
    teenSample: 'Great question! It splits completely into ions in water. You’re getting this.',
    adultSample: 'Good one! An explicit deny anywhere wins. You’ve nearly got this.',
  },
  {
    value: 'TO_THE_POINT',
    label: 'Straight to the point',
    subtitle: 'Short answers, no small talk',
    teenSample: 'It fully splits into ions in water.',
    adultSample: 'Explicit deny wins. Always.',
  },
  {
    value: 'DETAILED',
    label: 'Detailed',
    subtitle: 'Fuller explanations, more examples',
    teenSample:
      'It splits completely into H⁺ and Cl⁻. Compare acetic acid, which only partly splits. Example: same strength, HCl gives more H⁺.',
    adultSample:
      'AWS checks every policy. Any explicit Deny ends it. Example: SCP denies s3:Delete, IAM allows it → denied.',
  },
  {
    value: 'CHALLENGING',
    label: 'Challenging',
    subtitle: 'Harder questions, makes you explain',
    teenSample: 'You tell me first: what happens to HCl in water? Then compare it with vinegar.',
    adultSample: 'What if the SCP has no statement at all? Explain before I answer.',
  },
] as const

export const TUTOR_QUICK_ACTIONS: readonly {
  value: TutorQuickAction
  label: string
}[] = [
  { value: 'EXPLAIN', label: 'Explain a topic' },
  { value: 'QUIZ', label: 'Quiz me' },
  { value: 'HOMEWORK', label: 'Work through a problem' },
  { value: 'BRIEF', label: 'Prepare a brief' },
  { value: 'CLARIFY', label: 'Clarify something' },
  { value: 'TODAY', label: 'What should I do today' },
] as const

export const TUTOR_NUDGE_KINDS: readonly {
  kind: TutorNudgeKind
  label: string
}[] = [
  { kind: 'LESSON_DONE', label: 'After a lesson' },
  { kind: 'RETURNED', label: 'When I come back after a few days' },
  { kind: 'EXAM_NEAR', label: 'When my exam is close' },
  { kind: 'STUCK', label: 'When I seem stuck' },
  { kind: 'FIRST_WRONG', label: 'After a wrong practice answer' },
  { kind: 'REPEATED_WRONG', label: 'When I miss the same idea twice' },
  { kind: 'READINESS_CHANGED', label: 'When my exam readiness changes' },
] as const

export const WEEKDAY_PILLS: readonly {
  day: number
  shortLabel: string
  fullLabel: string
}[] = [
  { day: 1, shortLabel: 'Mon', fullLabel: 'Monday' },
  { day: 2, shortLabel: 'Tue', fullLabel: 'Tuesday' },
  { day: 3, shortLabel: 'Wed', fullLabel: 'Wednesday' },
  { day: 4, shortLabel: 'Thu', fullLabel: 'Thursday' },
  { day: 5, shortLabel: 'Fri', fullLabel: 'Friday' },
  { day: 6, shortLabel: 'Sat', fullLabel: 'Saturday' },
  { day: 7, shortLabel: 'Sun', fullLabel: 'Sunday' },
] as const

export const STUDY_MINUTE_PRESETS = [20, 40, 45, 60] as const

export function getStyleSampleAnswer(
  style: TutorStyle,
  band: '14-17' | '18+' | 'teens' | 'adults' = '14-17',
): string {
  const isAdult = band === '18+' || band === 'adults'
  const found = TUTOR_STYLES.find((item) => item.value === style) ?? TUTOR_STYLES[0]!
  return isAdult ? found.adultSample : found.teenSample
}

const DISALLOWED_TUTOR_WORDS = new Set([
  'admin',
  'administrator',
  'teacher',
  'instructor',
  'professor',
  'parent',
  'guardian',
  'principal',
  'moderator',
  'system',
  'support',
  'staff',
  'official',
  'colearner',
  'ignore',
  'prompt',
  'instruction',
  'instructions',
  'bypass',
  'override',
  'stupid',
  'idiot',
  'dumb',
  'sex',
  'porn',
  'nude',
  'hate',
  'kill',
  'die',
  'murder',
  'terror',
  'fuck',
  'shit',
  'bitch',
  'ass',
])

const INVISIBLE_OR_CONTROL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\uFEFF]/
const URL_OR_HANDLE = /https?:|www\.|@|\.com\b|\.org\b|\.net\b/i
const VALID_NAME_CHARS = /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u

function countGraphemes(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text)).length
  }
  return Array.from(text).length
}

/**
 * Validates and normalizes the learner's chosen tutor name per Contract §7:
 * - NFC normalized
 * - Empty/null resets to "Co"
 * - 1–16 grapheme clusters after trim
 * - Letters/marks and single internal spaces or apostrophe/hyphen only
 * - Denies age-inappropriate words, instructions, trusted role names, control/invisible code points or URLs
 */
export function validateTutorName(raw: string | null | undefined): {
  valid: boolean
  normalized: string
  error?: string
} {
  if (raw === null || raw === undefined) {
    return { valid: true, normalized: 'Co' }
  }
  if (INVISIBLE_OR_CONTROL.test(raw)) {
    return { valid: false, normalized: raw, error: 'Try a different name' }
  }
  const normalized = raw.normalize('NFC').trim()
  if (normalized.length === 0) {
    return { valid: true, normalized: 'Co' }
  }
  const graphemes = countGraphemes(normalized)
  if (graphemes < 1 || graphemes > 16) {
    return { valid: false, normalized, error: 'Use up to 16 characters' }
  }
  if (URL_OR_HANDLE.test(normalized) || !VALID_NAME_CHARS.test(normalized)) {
    return { valid: false, normalized, error: 'Try a different name' }
  }
  const tokens = normalized
    .toLowerCase()
    .split(/[\s'’-]+/)
    .filter(Boolean)
  if (
    DISALLOWED_TUTOR_WORDS.has(normalized.toLowerCase()) ||
    tokens.some((token) => DISALLOWED_TUTOR_WORDS.has(token))
  ) {
    return { valid: false, normalized, error: 'Try a different name' }
  }
  return { valid: true, normalized }
}

/**
 * Applies accessibility preferences directly to the document root so text scale,
 * easy-read font, reduced motion (`data-calm`), and read-aloud work immediately across the app.
 */
export function applyAccessibilityToDocument(
  accessibility: TutorAccessibility,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): void {
  if (!doc?.documentElement) return
  const root = doc.documentElement
  const scaleMap: Record<TutorTextScale, { attr: string; factor: number }> = {
    NORMAL: { attr: 'normal', factor: 1 },
    LARGE: { attr: 'large', factor: 1.15 },
    EXTRA_LARGE: { attr: 'extra-large', factor: 1.3 },
  }
  const scale = scaleMap[accessibility.textScale] ?? scaleMap.NORMAL
  root.setAttribute('data-tutor-text-scale', scale.attr)
  root.classList.toggle('tutor-text-large', accessibility.textScale === 'LARGE')
  root.classList.toggle('tutor-text-extra-large', accessibility.textScale === 'EXTRA_LARGE')
  root.style.setProperty('--tutor-text-scale', String(scale.factor))
  if (accessibility.textScale === 'NORMAL') {
    root.style.removeProperty('--ds-body')
    root.style.removeProperty('--ds-small')
  } else {
    root.style.setProperty('--ds-body', `${Math.round(16 * scale.factor)}px`)
    root.style.setProperty('--ds-small', `${Math.round(14 * scale.factor)}px`)
  }

  root.setAttribute('data-tutor-easy-read', accessibility.easyRead ? 'true' : 'false')
  root.classList.toggle('tutor-easy-read', accessibility.easyRead)
  if (accessibility.easyRead) {
    root.style.setProperty(
      '--ds-body-font',
      "'Atkinson Hyperlegible', var(--font-geist, 'Geist'), system-ui, sans-serif",
    )
  } else {
    root.style.removeProperty('--ds-body-font')
  }

  root.setAttribute('data-tutor-reduced-motion', accessibility.reducedMotion ? 'true' : 'false')
  root.setAttribute('data-calm', accessibility.reducedMotion ? 'on' : 'off')
  root.classList.toggle('tutor-reduced-motion', accessibility.reducedMotion)

  root.setAttribute('data-tutor-read-aloud', accessibility.readAloud ? 'true' : 'false')
  root.classList.toggle('tutor-read-aloud', accessibility.readAloud)
}

/**
 * Speaks tutor text using local/on-device speechSynthesis where available,
 * never sending learner material to an external speech processor (Contract §9).
 */
export function speakTutorText(text: string): { spoken: boolean; fallbackText: string } {
  const clean = text.trim()
  if (!clean) return { spoken: false, fallbackText: '' }
  if (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  ) {
    try {
      window.speechSynthesis.cancel()
      const utterance = new window.SpeechSynthesisUtterance(clean)
      window.speechSynthesis.speak(utterance)
      return { spoken: true, fallbackText: clean }
    } catch {
      return { spoken: false, fallbackText: clean }
    }
  }
  return { spoken: false, fallbackText: clean }
}

const DEFAULT_PROFILE_FIXTURE: TutorProfile = {
  revision: 1,
  name: 'Co',
  icon: 'SPROUT',
  style: 'FRIENDLY',
  presence: 'AVAILABLE',
  nudgesEnabled: true,
  pinnedActions: ['EXPLAIN', 'QUIZ', 'BRIEF'],
  memoryOptIn: true,
  generalOptOut: true,
  accessibility: {
    textScale: 'NORMAL',
    easyRead: false,
    reducedMotion: false,
    readAloud: false,
  },
}

const DEFAULT_PREFERENCES_FIXTURE: TutorStudyPreferences = {
  revision: 1,
  timeZone: 'Asia/Dubai',
  studyDays: [1, 2, 3, 4, 5],
  minutesPerDay: 40,
}

const DEFAULT_MEMORY_FIXTURE: TutorMemoryResponse = {
  enabled: true,
  visibleToLinkedParent: true,
  facts: [
    {
      id: '10000000-0000-4000-8000-000000000012',
      kind: 'PREFERENCE',
      statement: 'Short explanations with one example help.',
      confidence: 'HIGH',
      source: 'LEARNER_EDITED',
      conceptRef: null,
      subjectRef: null,
      evidence: [
        {
          kind: 'SESSION',
          id: '10000000-0000-4000-8000-000000000009',
        },
      ],
      lastConfirmedAt: '2026-11-13T09:00:00Z',
      expiresAt: null,
      revision: 2,
    },
  ],
}

let memoryProfileState: TutorProfile = structuredClone(DEFAULT_PROFILE_FIXTURE)
let memoryPreferencesState: TutorStudyPreferences = structuredClone(DEFAULT_PREFERENCES_FIXTURE)
let memoryFactsState: TutorMemoryResponse = structuredClone(DEFAULT_MEMORY_FIXTURE)
let memoryNudgeMutes: Record<string, boolean> = {}

export function resetTutorProfileFixtureState(band: '14-17' | '18+' = '14-17'): void {
  memoryProfileState = {
    ...structuredClone(DEFAULT_PROFILE_FIXTURE),
    icon: band === '18+' ? 'BUDDY' : 'SPROUT',
    generalOptOut: band === '18+' ? false : true,
  }
  memoryPreferencesState = structuredClone(DEFAULT_PREFERENCES_FIXTURE)
  memoryFactsState = {
    ...structuredClone(DEFAULT_MEMORY_FIXTURE),
    visibleToLinkedParent: band !== '18+',
  }
  memoryNudgeMutes = {}
}

export interface TutorRequestOptions {
  baseUrl?: string
  workspace?: 'school' | 'personal'
  token?: string
  membership?: string
  useFixtureFallback?: boolean
}

async function tutorFetch<T>(
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

export async function getTutorProfile(options?: TutorRequestOptions): Promise<TutorProfile> {
  return tutorFetch('/profile', tutorProfileSchema, {
    method: 'GET',
    options,
    fallback: () => structuredClone(memoryProfileState),
  })
}

export async function updateTutorProfile(
  patch: TutorProfilePatch,
  options?: TutorRequestOptions,
): Promise<TutorProfile> {
  if (patch.name !== undefined) {
    const check = validateTutorName(patch.name)
    if (!check.valid) {
      throw new TutorLoopApiError(422, 'INVALID_TUTOR_NAME', check.error ?? 'Try a different name')
    }
  }
  if (patch.pinnedActions && patch.pinnedActions.length > 4) {
    throw new TutorLoopApiError(400, 'INVALID_REQUEST', 'You can pin up to 4 quick actions.')
  }
  const normalizedPatch: TutorProfilePatch = {
    ...patch,
    ...(patch.name !== undefined ? { name: validateTutorName(patch.name).normalized } : {}),
  }
  return tutorFetch('/profile', tutorProfileSchema, {
    method: 'PATCH',
    body: normalizedPatch,
    options,
    fallback: () => {
      memoryProfileState = {
        ...memoryProfileState,
        revision: memoryProfileState.revision + 1,
        ...(normalizedPatch.name !== undefined && normalizedPatch.name !== null
          ? { name: normalizedPatch.name }
          : {}),
        ...(normalizedPatch.icon !== undefined ? { icon: normalizedPatch.icon } : {}),
        ...(normalizedPatch.style !== undefined ? { style: normalizedPatch.style } : {}),
        ...(normalizedPatch.presence !== undefined ? { presence: normalizedPatch.presence } : {}),
        ...(normalizedPatch.nudgesEnabled !== undefined
          ? { nudgesEnabled: normalizedPatch.nudgesEnabled }
          : {}),
        ...(normalizedPatch.pinnedActions !== undefined
          ? { pinnedActions: normalizedPatch.pinnedActions }
          : {}),
        ...(normalizedPatch.memoryOptIn !== undefined
          ? { memoryOptIn: normalizedPatch.memoryOptIn }
          : {}),
        ...(normalizedPatch.generalOptOut !== undefined
          ? { generalOptOut: normalizedPatch.generalOptOut }
          : {}),
        accessibility: {
          ...memoryProfileState.accessibility,
          ...(normalizedPatch.accessibility ?? {}),
        },
      }
      if (normalizedPatch.memoryOptIn !== undefined) {
        memoryFactsState = {
          ...memoryFactsState,
          enabled: normalizedPatch.memoryOptIn,
        }
      }
      return structuredClone(memoryProfileState)
    },
  })
}

export async function getStudyPreferences(
  options?: TutorRequestOptions,
): Promise<TutorStudyPreferences> {
  return tutorFetch('/study-preferences', tutorStudyPreferencesSchema, {
    method: 'GET',
    options,
    fallback: () => structuredClone(memoryPreferencesState),
  })
}

export async function previewStudyPreferences(
  input: StudyPreferencesPreviewInput,
  options?: TutorRequestOptions,
): Promise<TutorSchedulePreview> {
  const days = input.studyDays ?? memoryPreferencesState.studyDays
  const minutes = input.minutesPerDay ?? memoryPreferencesState.minutesPerDay
  if (days.length === 0 || days.some((d) => d < 1 || d > 7)) {
    throw new TutorLoopApiError(400, 'INVALID_REQUEST', 'Pick at least one study day.')
  }
  if (minutes < 5 || minutes > 240) {
    throw new TutorLoopApiError(400, 'INVALID_REQUEST', 'Choose between 5 and 240 minutes a day.')
  }
  return tutorFetch('/study-preferences/preview', tutorSchedulePreviewSchema, {
    method: 'POST',
    body: input,
    options,
    fallback: () => {
      if (input.timeZone) memoryPreferencesState.timeZone = input.timeZone
      if (input.studyDays) memoryPreferencesState.studyDays = [...input.studyDays]
      if (input.minutesPerDay) memoryPreferencesState.minutesPerDay = input.minutesPerDay
      return {
        id: '10000000-0000-4000-8000-000000000014',
        baseRevision: input.revision,
        expiresAt: '2026-11-13T09:15:00Z',
        canApply: true,
        changes: [
          {
            itemId: '10000000-0000-4000-8000-000000000016',
            from: '2026-11-13',
            to: '2026-11-15',
            reasonCode: 'USER_MOVED',
          },
        ],
        conflicts: [],
        unplacedMinutes: 0,
      }
    },
  })
}

export async function applySchedulePreview(
  previewId: string,
  input: { clientRequestId: string; baseRevision: number },
  options?: TutorRequestOptions,
): Promise<TutorScheduleApplied> {
  return tutorFetch(`/schedule/previews/${encodeURIComponent(previewId)}/apply`, scheduleAppliedSchema, {
    method: 'POST',
    body: input,
    options,
    fallback: () => {
      memoryPreferencesState = {
        ...memoryPreferencesState,
        revision: memoryPreferencesState.revision + 1,
      }
      return {
        previewId,
        revision: input.baseRevision + 1,
        appliedAt: '2026-11-13T09:00:00Z',
      }
    },
  })
}

export async function setNudgeMute(
  kind: TutorNudgeKind,
  muted: boolean,
  options?: TutorRequestOptions,
): Promise<{ kind: TutorNudgeKind; muted: boolean }> {
  const schema = z.object({ kind: tutorNudgeKindSchema, muted: z.boolean() })
  return tutorFetch(`/co/nudges/mutes/${encodeURIComponent(kind)}`, schema, {
    method: 'PUT',
    body: { muted },
    options,
    fallback: () => {
      memoryNudgeMutes[kind] = muted
      return { kind, muted }
    },
  })
}

export function getLocalNudgeMutes(): Record<string, boolean> {
  return { ...memoryNudgeMutes }
}

export async function getTutorMemory(
  options?: TutorRequestOptions,
): Promise<TutorMemoryResponse> {
  return tutorFetch('/co/memory', tutorMemoryResponseSchema, {
    method: 'GET',
    options,
    fallback: () => structuredClone(memoryFactsState),
  })
}

export async function updateTutorMemoryFact(
  factId: string,
  input: { revision: number; statement: string },
  options?: TutorRequestOptions,
): Promise<TutorMemoryFact> {
  const trimmed = input.statement.trim()
  if (!trimmed || trimmed.length > 180) {
    throw new TutorLoopApiError(
      422,
      'NON_LEARNING_MEMORY',
      'Keep notes about how you learn between 1 and 180 characters.',
    )
  }
  return tutorFetch(`/co/memory/${encodeURIComponent(factId)}`, tutorMemoryFactSchema, {
    method: 'PATCH',
    body: { revision: input.revision, statement: trimmed },
    options,
    fallback: () => {
      const existing = memoryFactsState.facts.find((f) => f.id === factId)
      const updated: TutorMemoryFact = existing
        ? {
            ...existing,
            statement: trimmed,
            confidence: 'HIGH',
            source: 'LEARNER_EDITED',
            revision: input.revision + 1,
          }
        : {
            id: factId,
            kind: 'PREFERENCE',
            statement: trimmed,
            confidence: 'HIGH',
            source: 'LEARNER_EDITED',
            conceptRef: null,
            subjectRef: null,
            evidence: [],
            lastConfirmedAt: '2026-11-13T09:00:00Z',
            expiresAt: null,
            revision: input.revision + 1,
          }
      memoryFactsState = {
        ...memoryFactsState,
        facts: memoryFactsState.facts.map((f) => (f.id === factId ? updated : f)),
      }
      return structuredClone(updated)
    },
  })
}

export async function deleteTutorMemoryFact(
  factId: string,
  revision: number,
  options?: TutorRequestOptions,
): Promise<{ removed: true }> {
  const schema = z.object({ removed: z.literal(true) })
  return tutorFetch(
    `/co/memory/${encodeURIComponent(factId)}?revision=${encodeURIComponent(String(revision))}`,
    schema,
    {
      method: 'DELETE',
      options,
      fallback: () => {
        memoryFactsState = {
          ...memoryFactsState,
          facts: memoryFactsState.facts.filter((f) => f.id !== factId),
        }
        return { removed: true as const }
      },
    },
  )
}

export async function forgetAllTutorMemory(
  clientRequestId: string,
  options?: TutorRequestOptions,
): Promise<TutorForgottenResponse> {
  return tutorFetch('/co/memory/forget', tutorForgottenSchema, {
    method: 'POST',
    body: { clientRequestId },
    options,
    fallback: () => {
      memoryFactsState = {
        ...memoryFactsState,
        facts: [],
      }
      return { forgotten: true as const, epoch: 3 }
    },
  })
}

export async function revokeAdultConsent(
  options?: TutorRequestOptions,
): Promise<AdultConsentRevokedResponse> {
  return tutorFetch('/adult-consent', adultConsentRevokedSchema, {
    method: 'DELETE',
    options,
    fallback: () => ({
      state: 'REVOKED' as const,
      revokedAt: '2026-11-13T09:00:00Z',
      revision: 2,
    }),
  })
}
