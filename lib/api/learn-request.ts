'use client'

import { z } from 'zod'
import { ApiError } from './client'

/** A server failure with the contract error code (CODE_INVALID, POLICY_BLOCKED, ...) when one is supplied. */
export class LearnApiError extends ApiError {
  constructor(status: number, message: string, readonly code?: string) { super(status, message); this.name = 'LearnApiError' }
}
/** Not an ApiError, so an expired child or learner session never triggers the adult global sign-out handler. */
export class LearnSessionError extends Error { readonly status = 401 }

const byStatus: Record<number, string> = {
  400: 'Check what you entered and try again. Your entries are still here.',
  401: 'Your learning session has ended. Check learner access to continue.',
  403: 'This learner, plan or action is not permitted by the current school and guardian settings.',
  404: 'This is unavailable, or you no longer have access to it.',
  409: 'This has changed. Refresh and review it before trying again.',
  410: 'This is no longer available.',
  429: 'Too many tries. Please wait a moment and try again.',
  503: 'Learning services are unavailable right now. Please try again.',
}
const byCode: Record<string, string> = {
  CHILD_PROFILE_REQUIRED: 'Your school profile is not linked yet. Ask your school to finish setting it up, then come back.',
  CONSENT_REQUIRED: 'A grown-up needs to say yes before you can learn here. Ask them to check your settings.',
  AGE_OUT_OF_SCOPE: 'Learning here is not available for this age yet.',
  SCHOOL_REQUIRED: 'Your school workspace is not active. Ask your school for help.',
  CODE_INVALID: 'That code did not work. Check it and try again.',
  CODE_EXPIRED: 'That code has expired. Ask your teacher for a new one.',
  ALREADY_ENROLLED: 'You are already part of this class plan.',
  PLAN_STRUCTURE_LOCKED: 'Your teacher controls the steps of this plan.',
  SKIP_NOT_ALLOWED: 'This step cannot be skipped.',
  // B09 practice. Server text is never shown for these; only POLICY_BLOCKED carries a reason that is contractually safe.
  SESSION_NOT_FOUND: 'We could not find that practice. It may have been removed.',
  SESSION_COMPLETED: 'This practice is already finished.',
  SESSION_EXPIRED: 'The time for this practice has run out.',
  SESSION_NOT_COMPLETED: 'This practice is not finished yet.',
  SESSION_IN_PROGRESS: 'This practice is not finished yet.',
  ITEM_OUT_OF_ORDER: 'Do the questions in order. Go back to the one you were on.',
  ATTEMPTS_EXHAUSTED: 'There are no tries left on this question. Move on to the next one.',
  HINT_OUT_OF_ORDER: 'Open the hints one at a time, starting with the first.',
  HINTS_DISABLED_IN_EXAM: 'Hints are switched off in a timed test.',
  ANSWER_KIND_MISMATCH: 'That answer does not fit this question. Please try again.',
  ANSWER_INVALID: 'That answer could not be read. Check it and try again.',
  NO_QUESTIONS_AVAILABLE: 'There are no questions ready to practise right now.',
  PRACTICE_UNAVAILABLE: 'Practice questions are not switched on for you yet.',
  PRACTICE_ACCESS_CHANGED: 'This practice is hidden because access to its material changed.',
  // The platform sends DAILY_PRACTICE_SET_LIMIT (429); the two older spellings below are kept for safety.
  DAILY_PRACTICE_SET_LIMIT: 'You have made all the question sets you can for today. Try again tomorrow.',
  DAILY_PRACTICE_LIMIT: 'You have made all the question sets you can for today. Try again tomorrow.',
  PRACTICE_LIMIT_REACHED: 'You have made all the question sets you can for today. Try again tomorrow.',
  MATERIAL_NOT_READY: 'This material is still being read. Come back when its key ideas are ready.',
  LESSON_NOT_READY: 'This lesson is not ready yet.',
  SET_NOT_READY: 'These questions are not ready yet.',
  SET_NOT_FOUND: 'We could not find those questions. They may have been removed.',
  TOPIC_NOT_FOUND: 'We could not find that topic. It may have been removed.',
  EXAM_NOT_AVAILABLE: 'There is no timed test ready for this plan yet.',
  SESSION_CONFLICT: 'This practice changed somewhere else. Open it again to carry on.',
  NOT_RETRYABLE: 'This cannot be tried again.',
  NOT_CANCELLABLE: 'This can no longer be stopped.',
  NOT_REGRADABLE: 'Co cannot check this answer again.',
  ITEM_NOT_FOUND: 'We could not find that question.',
  ITEM_CLOSED: 'That question is already finished. Move on to the next one.',
  ATTEMPT_PENDING: 'Co is still checking your last answer. One moment.',
  ATTEMPT_CONFLICT: 'That answer did not match the one we already have. Please check it and send it again.',
  HINT_UNAVAILABLE: 'There is no hint for this question.',
  SKIP_DISABLED_IN_EXAM: 'You cannot skip questions in a timed test.',
  REGRADE_LIMIT: 'Co has already checked this answer again. Ask your teacher if you need more help.',
  FEEDBACK_UNAVAILABLE: 'Co could not check this answer right now.',
}
const codePattern = /^[A-Z][A-Z0-9_]{2,63}$/

function errorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  if (typeof record.code === 'string' && codePattern.test(record.code)) return record.code
  const nested = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>).code : undefined
  if (typeof nested === 'string' && codePattern.test(nested)) return nested
  if (typeof record.message === 'string' && codePattern.test(record.message)) return record.message
  return undefined
}

/** Maps a failed response to a safe learner message. Server text is shown only for POLICY_BLOCKED, whose reason is contractually safe. */
export function learnErrorMessage(status: number, code: string | undefined, body?: unknown): string {
  if (code === 'POLICY_BLOCKED') {
    const reason = body && typeof body === 'object' ? (body as Record<string, unknown>).message : undefined
    if (typeof reason === 'string' && reason.length > 0 && reason.length <= 240 && !codePattern.test(reason)) return reason
    return 'Your school or family settings do not allow this right now.'
  }
  return (code ? byCode[code] : undefined) ?? byStatus[status] ?? 'Learning services are unavailable right now. Please try again.'
}

/** The same-origin BFF checks the current account or opaque child cookie on every dispatch. */
export async function learnRequest<T>(path: string, schema: z.ZodType<T>, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/learn${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(30000),
    })
  } catch { throw new LearnApiError(503, byStatus[503]!) }
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null)
    if (response.status === 401) throw new LearnSessionError(byStatus[401]!)
    const code = errorCode(failure)
    throw new LearnApiError(response.status, learnErrorMessage(response.status, code, failure), code)
  }
  // A 204 (for example a deleted note) carries no body; the caller's schema then validates `undefined`.
  const json: unknown = response.status === 204 ? undefined : await response.json().catch(() => { throw new LearnApiError(502, 'Learning services returned something unexpected. Please refresh or try again later.') })
  const data = json !== null && typeof json === 'object' && 'data' in json ? json.data : json
  const result = schema.safeParse(data)
  if (!result.success) throw new LearnApiError(502, 'Learning services returned something unexpected. Please refresh or try again later.')
  return result.data
}
