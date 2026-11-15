import { z } from 'zod'

export const tutorModes = [
  'ASK',
  'EXPLAIN',
  'EXPLAIN_DIFFERENTLY',
  'QUIZ',
  'HOMEWORK',
  'TEACH_BACK',
  'BRIEF',
  'CLARIFY',
  'TODAY',
] as const

export type TutorMode = (typeof tutorModes)[number]

export const tutorQuickActionModes = [
  'EXPLAIN',
  'QUIZ',
  'HOMEWORK',
  'BRIEF',
  'CLARIFY',
  'TODAY',
] as const

export type TutorQuickActionMode = (typeof tutorQuickActionModes)[number]

export const tutorContextKinds = [
  'GLOBAL',
  'PLAN_TOPIC',
  'MATERIAL',
  'LESSON',
  'PRACTICE_RESULT',
  'MOCK_RESULT',
  'HOMEWORK',
  'TEACH_BACK',
] as const

export type TutorContextKind = (typeof tutorContextKinds)[number]

export type TutorContextDescriptor =
  | { kind: 'GLOBAL' }
  | { kind: 'PLAN_TOPIC'; planId: string; topicId: string }
  | { kind: 'MATERIAL'; materialId: string; passageRef?: string | null }
  | { kind: 'LESSON'; lessonId: string; stepIndex?: number | null }
  | { kind: 'PRACTICE_RESULT'; sessionId: string; attemptId: string }
  | { kind: 'MOCK_RESULT'; sessionId: string }
  | { kind: 'HOMEWORK'; homeworkSessionId: string }
  | { kind: 'TEACH_BACK'; sessionId: string }

const safeIdPattern = /^[a-zA-Z0-9_.:-]{1,128}$/
const safeId = z.string().regex(safeIdPattern)
const safeStepIndex = z.number().int().min(0).max(500)

export const tutorModeSchema = z.enum(tutorModes)

export const tutorContextDescriptorSchema: z.ZodType<TutorContextDescriptor> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('GLOBAL') }).strict(),
  z.object({ kind: z.literal('PLAN_TOPIC'), planId: safeId, topicId: safeId }).strict(),
  z
    .object({
      kind: z.literal('MATERIAL'),
      materialId: safeId,
      passageRef: safeId.nullable().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('LESSON'),
      lessonId: safeId,
      stepIndex: safeStepIndex.nullable().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('PRACTICE_RESULT'), sessionId: safeId, attemptId: safeId }).strict(),
  z.object({ kind: z.literal('MOCK_RESULT'), sessionId: safeId }).strict(),
  z.object({ kind: z.literal('HOMEWORK'), homeworkSessionId: safeId }).strict(),
  z.object({ kind: z.literal('TEACH_BACK'), sessionId: safeId }).strict(),
])

export interface TutorOpenOptions {
  mode?: TutorMode | null
  sessionId?: string | null
  returnTo?: TutorContextDescriptor | null
  router?: { push: (href: string) => void } | null
  navigate?: ((href: string) => void) | null
}

export function isValidTutorId(value: unknown): value is string {
  return typeof value === 'string' && safeIdPattern.test(value)
}

export function sanitizeTutorContext(
  context: TutorContextDescriptor | null | undefined,
): TutorContextDescriptor {
  if (!context) return { kind: 'GLOBAL' }
  switch (context.kind) {
    case 'GLOBAL':
      return { kind: 'GLOBAL' }
    case 'PLAN_TOPIC':
      if (isValidTutorId(context.planId) && isValidTutorId(context.topicId)) {
        return { kind: 'PLAN_TOPIC', planId: context.planId, topicId: context.topicId }
      }
      return { kind: 'GLOBAL' }
    case 'MATERIAL':
      if (isValidTutorId(context.materialId)) {
        const passageRef = isValidTutorId(context.passageRef) ? context.passageRef : undefined
        return passageRef
          ? { kind: 'MATERIAL', materialId: context.materialId, passageRef }
          : { kind: 'MATERIAL', materialId: context.materialId }
      }
      return { kind: 'GLOBAL' }
    case 'LESSON':
      if (isValidTutorId(context.lessonId)) {
        const step =
          typeof context.stepIndex === 'number' &&
          Number.isInteger(context.stepIndex) &&
          context.stepIndex >= 0 &&
          context.stepIndex <= 500
            ? context.stepIndex
            : undefined
        return step !== undefined
          ? { kind: 'LESSON', lessonId: context.lessonId, stepIndex: step }
          : { kind: 'LESSON', lessonId: context.lessonId }
      }
      return { kind: 'GLOBAL' }
    case 'PRACTICE_RESULT':
      if (isValidTutorId(context.sessionId) && isValidTutorId(context.attemptId)) {
        return {
          kind: 'PRACTICE_RESULT',
          sessionId: context.sessionId,
          attemptId: context.attemptId,
        }
      }
      return { kind: 'GLOBAL' }
    case 'MOCK_RESULT':
      if (isValidTutorId(context.sessionId)) {
        return { kind: 'MOCK_RESULT', sessionId: context.sessionId }
      }
      return { kind: 'GLOBAL' }
    case 'HOMEWORK':
      if (isValidTutorId(context.homeworkSessionId)) {
        return { kind: 'HOMEWORK', homeworkSessionId: context.homeworkSessionId }
      }
      return { kind: 'GLOBAL' }
    case 'TEACH_BACK':
      if (isValidTutorId(context.sessionId)) {
        return { kind: 'TEACH_BACK', sessionId: context.sessionId }
      }
      return { kind: 'GLOBAL' }
    default:
      return { kind: 'GLOBAL' }
  }
}

/**
 * Encodes a closed TutorContextDescriptor into strict query parameters for `GET /co/context`
 * or `/learn/co` navigation. Never includes learner freeform text.
 */
export function tutorContextToQuery(
  context: TutorContextDescriptor | null | undefined,
): Record<string, string> {
  const safe = sanitizeTutorContext(context)
  switch (safe.kind) {
    case 'GLOBAL':
      return { kind: 'GLOBAL' }
    case 'PLAN_TOPIC':
      return { kind: 'PLAN_TOPIC', planId: safe.planId, topicId: safe.topicId }
    case 'MATERIAL':
      return safe.passageRef
        ? { kind: 'MATERIAL', materialId: safe.materialId, passageRef: safe.passageRef }
        : { kind: 'MATERIAL', materialId: safe.materialId }
    case 'LESSON':
      return safe.stepIndex !== undefined && safe.stepIndex !== null
        ? { kind: 'LESSON', lessonId: safe.lessonId, stepIndex: String(safe.stepIndex) }
        : { kind: 'LESSON', lessonId: safe.lessonId }
    case 'PRACTICE_RESULT':
      return {
        kind: 'PRACTICE_RESULT',
        sessionId: safe.sessionId,
        attemptId: safe.attemptId,
      }
    case 'MOCK_RESULT':
      return { kind: 'MOCK_RESULT', sessionId: safe.sessionId }
    case 'HOMEWORK':
      return { kind: 'HOMEWORK', homeworkSessionId: safe.homeworkSessionId }
    case 'TEACH_BACK':
      return { kind: 'TEACH_BACK', sessionId: safe.sessionId }
  }
}

/**
 * Builds a clean, safe `/learn/co` or `/learn/co/:sessionId` href using only closed enums and IDs.
 * Never embeds learner text or raw URLs in query parameters.
 */
export function buildTutorHref(
  context: TutorContextDescriptor | null | undefined = { kind: 'GLOBAL' },
  options?: TutorOpenOptions,
): string {
  const safeContext = sanitizeTutorContext(context)
  const sessionId = options?.sessionId && isValidTutorId(options.sessionId) ? options.sessionId : null
  const basePath = sessionId ? `/learn/co/${encodeURIComponent(sessionId)}` : '/learn/co'

  const params = new URLSearchParams()
  if (safeContext.kind !== 'GLOBAL') {
    const queryRecord = tutorContextToQuery(safeContext)
    for (const [key, value] of Object.entries(queryRecord)) {
      params.set(key, value)
    }
  }

  if (options?.mode && (tutorModes as readonly string[]).includes(options.mode)) {
    params.set('mode', options.mode)
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function getParam(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  if (source instanceof URLSearchParams) {
    const val = source.get(key)
    return val ?? undefined
  }
  const raw = source[key]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

/**
 * Parses URL search parameters back into a validated `TutorContextDescriptor` and optional `TutorMode`.
 * Unknown keys or invalid IDs safely fall back to `{ kind: 'GLOBAL' }`.
 */
export function parseTutorContextFromSearchParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): { context: TutorContextDescriptor; mode?: TutorMode } {
  if (!searchParams) return { context: { kind: 'GLOBAL' } }

  const rawMode = getParam(searchParams, 'mode')
  const mode =
    rawMode && (tutorModes as readonly string[]).includes(rawMode)
      ? (rawMode as TutorMode)
      : undefined

  const kind = getParam(searchParams, 'kind')
  let context: TutorContextDescriptor = { kind: 'GLOBAL' }

  switch (kind) {
    case 'PLAN_TOPIC': {
      const planId = getParam(searchParams, 'planId')
      const topicId = getParam(searchParams, 'topicId')
      if (isValidTutorId(planId) && isValidTutorId(topicId)) {
        context = { kind: 'PLAN_TOPIC', planId, topicId }
      }
      break
    }
    case 'MATERIAL': {
      const materialId = getParam(searchParams, 'materialId')
      const passageRef = getParam(searchParams, 'passageRef')
      if (isValidTutorId(materialId)) {
        context = isValidTutorId(passageRef)
          ? { kind: 'MATERIAL', materialId, passageRef }
          : { kind: 'MATERIAL', materialId }
      }
      break
    }
    case 'LESSON': {
      const lessonId = getParam(searchParams, 'lessonId')
      const rawStep = getParam(searchParams, 'stepIndex')
      if (isValidTutorId(lessonId)) {
        const parsedStep = rawStep !== undefined && /^\d{1,3}$/.test(rawStep) ? Number(rawStep) : undefined
        context =
          parsedStep !== undefined && parsedStep >= 0 && parsedStep <= 500
            ? { kind: 'LESSON', lessonId, stepIndex: parsedStep }
            : { kind: 'LESSON', lessonId }
      }
      break
    }
    case 'PRACTICE_RESULT': {
      const sessionId = getParam(searchParams, 'sessionId')
      const attemptId = getParam(searchParams, 'attemptId')
      if (isValidTutorId(sessionId) && isValidTutorId(attemptId)) {
        context = { kind: 'PRACTICE_RESULT', sessionId, attemptId }
      }
      break
    }
    case 'MOCK_RESULT': {
      const sessionId = getParam(searchParams, 'sessionId')
      if (isValidTutorId(sessionId)) {
        context = { kind: 'MOCK_RESULT', sessionId }
      }
      break
    }
    case 'HOMEWORK': {
      const homeworkSessionId = getParam(searchParams, 'homeworkSessionId')
      if (isValidTutorId(homeworkSessionId)) {
        context = { kind: 'HOMEWORK', homeworkSessionId }
      }
      break
    }
    case 'TEACH_BACK': {
      const sessionId = getParam(searchParams, 'sessionId')
      if (isValidTutorId(sessionId)) {
        context = { kind: 'TEACH_BACK', sessionId }
      }
      break
    }
    default: {
      // Also support legacy direct query params if kind was omitted:
      const lessonId = getParam(searchParams, 'lessonId')
      const materialId = getParam(searchParams, 'materialId')
      const planId = getParam(searchParams, 'planId')
      const topicId = getParam(searchParams, 'topicId')
      if (isValidTutorId(planId) && isValidTutorId(topicId)) {
        context = { kind: 'PLAN_TOPIC', planId, topicId }
      } else if (isValidTutorId(lessonId)) {
        const rawStep = getParam(searchParams, 'stepIndex')
        const parsedStep = rawStep !== undefined && /^\d{1,3}$/.test(rawStep) ? Number(rawStep) : undefined
        context =
          parsedStep !== undefined && parsedStep >= 0 && parsedStep <= 500
            ? { kind: 'LESSON', lessonId, stepIndex: parsedStep }
            : { kind: 'LESSON', lessonId }
      } else if (isValidTutorId(materialId)) {
        const passageRef = getParam(searchParams, 'passageRef')
        context = isValidTutorId(passageRef)
          ? { kind: 'MATERIAL', materialId, passageRef }
          : { kind: 'MATERIAL', materialId }
      }
      break
    }
  }

  return mode ? { context, mode } : { context }
}

/**
 * Resolves a server-returned `returnTo` descriptor into a safe internal navigation target
 * for the "You came from…" context bar.
 */
export function resolveReturnToTarget(
  returnTo: TutorContextDescriptor | null | undefined,
  sourceTitle?: string | null,
): { href: string; categoryLabel: string; detailLabel: string } | null {
  if (!returnTo) return null
  const safe = sanitizeTutorContext(returnTo)
  switch (safe.kind) {
    case 'GLOBAL':
      return null
    case 'PLAN_TOPIC':
      return {
        href: `/learn/plans/${encodeURIComponent(safe.planId)}?topicId=${encodeURIComponent(safe.topicId)}`,
        categoryLabel: 'Plans',
        detailLabel: sourceTitle || 'My plan topic',
      }
    case 'MATERIAL': {
      const params = new URLSearchParams()
      if (safe.passageRef) params.set('passageRef', safe.passageRef)
      const query = params.toString()
      return {
        href: `/learn/library/${encodeURIComponent(safe.materialId)}${query ? `?${query}` : ''}`,
        categoryLabel: 'Reader',
        detailLabel: sourceTitle || 'Material reader',
      }
    }
    case 'LESSON': {
      const params = new URLSearchParams()
      if (safe.stepIndex !== undefined && safe.stepIndex !== null) {
        params.set('step', String(safe.stepIndex))
      }
      const query = params.toString()
      return {
        href: `/learn/lesson/${encodeURIComponent(safe.lessonId)}${query ? `?${query}` : ''}`,
        categoryLabel: 'Lesson',
        detailLabel: sourceTitle || 'Guided lesson',
      }
    }
    case 'PRACTICE_RESULT':
      return {
        href: `/learn/practice/session/${encodeURIComponent(safe.sessionId)}?attemptId=${encodeURIComponent(safe.attemptId)}`,
        categoryLabel: 'Practice',
        detailLabel: sourceTitle || 'Practice question',
      }
    case 'MOCK_RESULT':
      return {
        href: `/learn/practice/mock/${encodeURIComponent(safe.sessionId)}/result`,
        categoryLabel: 'Mock exam',
        detailLabel: sourceTitle || 'Mock exam result',
      }
    case 'HOMEWORK':
      return {
        href: `/learn/homework/${encodeURIComponent(safe.homeworkSessionId)}`,
        categoryLabel: 'Homework',
        detailLabel: sourceTitle || 'Homework session',
      }
    case 'TEACH_BACK':
      return {
        href: `/learn/teach/${encodeURIComponent(safe.sessionId)}`,
        categoryLabel: 'Teach-back',
        detailLabel: sourceTitle || 'Teach-back session',
      }
  }
}

/**
 * Client navigation helper for opening the full-page Tutor (`Ask Co`) with a typed context descriptor.
 * Returns the constructed safe href and invokes the provided router/navigate callback (or updates history).
 */
export function openTutor(
  context: TutorContextDescriptor = { kind: 'GLOBAL' },
  optionsOrSecondArg?:
    | TutorOpenOptions
    | TutorContextDescriptor
    | { push: (href: string) => void }
    | ((href: string) => void)
    | null,
  navigateArg?: ((href: string) => void) | { push: (href: string) => void } | null,
): string {
  let options: TutorOpenOptions = {}

  if (typeof optionsOrSecondArg === 'function') {
    options = { navigate: optionsOrSecondArg }
  } else if (optionsOrSecondArg && typeof optionsOrSecondArg === 'object') {
    if ('push' in optionsOrSecondArg && typeof optionsOrSecondArg.push === 'function') {
      options = { router: optionsOrSecondArg }
    } else if ('kind' in optionsOrSecondArg && typeof optionsOrSecondArg.kind === 'string') {
      options = { returnTo: optionsOrSecondArg as TutorContextDescriptor }
    } else {
      options = optionsOrSecondArg as TutorOpenOptions
    }
  }

  const href = buildTutorHref(context, options)

  if (typeof navigateArg === 'function') {
    navigateArg(href)
  } else if (navigateArg && typeof navigateArg === 'object' && typeof navigateArg.push === 'function') {
    navigateArg.push(href)
  } else if (options.navigate) {
    options.navigate(href)
  } else if (options.router) {
    options.router.push(href)
  } else if (typeof window !== 'undefined' && typeof window.history?.pushState === 'function') {
    window.history.pushState(null, '', href)
  }

  return href
}
