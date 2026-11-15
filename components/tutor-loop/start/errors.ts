import { formatTutorErrorMessage } from '@/lib/api/tutor-loop/client'

export interface FriendlyError {
  message: string
  code?: string
  status?: number
  /** Co cannot draft right now; the manual path stays available. */
  resting: boolean
}

const restingCodes = new Set(['AI_UNAVAILABLE', 'TUTOR_RESTING', 'TUTOR_UNAVAILABLE', 'DAILY_PLAN_LIMIT'])

/** Turns any thrown value from the Tutor Loop clients into closed learner-facing copy. */
export function friendlyError(error: unknown, fallback = 'We could not do that. Try again.'): FriendlyError {
  if (error && typeof error === 'object') {
    const record = error as { status?: unknown; code?: unknown }
    const status = typeof record.status === 'number' ? record.status : undefined
    const code = typeof record.code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(record.code) ? record.code : undefined
    if (status !== undefined) {
      return { message: status >= 500 ? fallback : formatTutorErrorMessage(status, code), code, status, resting: code !== undefined && restingCodes.has(code) }
    }
  }
  return { message: fallback, resting: false }
}
