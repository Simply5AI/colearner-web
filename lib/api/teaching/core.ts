import { ApiError } from '../client'
import { schoolRequest } from '../school'
import { platformApiBaseUrl } from '../platform-client'

/** B12 shared transport for `/schools/:schoolId/teaching/*`. The server is the gate; this only carries the credential. */
export type TeachingMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export const teachingPath = (schoolId: string, suffix: string) =>
  `/schools/${encodeURIComponent(schoolId)}/teaching${suffix}`

/** Error carrying the platform error code (for example PLAN_NOT_READY) when the server sent one. */
export class TeachingApiError extends ApiError {
  constructor(
    status: number,
    message: string,
    public code: string | null = null,
    public currentRevision: number | null = null,
  ) {
    super(status, message)
    this.name = 'TeachingApiError'
  }
}

const statusMessage = (status: number) =>
  status === 403
    ? 'You do not have permission for this school or action.'
    : status === 404
      ? 'That item was not found, or you no longer have access to it.'
      : status === 401
        ? 'Your session has expired. Log in again.'
        : status === 409
          ? 'This conflicts with the current record. Refresh and review before retrying.'
          : status === 400 || status === 422
            ? 'Check the supplied details and try again.'
            : status === 503
              ? 'Teaching workspace is unavailable right now. Your draft is still here; try again.'
              : 'Teaching services are unavailable. Please try again.'

/**
 * Wraps `schoolRequest`. `schoolRequest` carries no custom headers, so a call with headers
 * (Idempotency-Key) uses the same fetch contract and error mapping here and also surfaces the error code.
 */
export async function teachingRequest<T>(
  token: string,
  schoolId: string,
  suffix: string,
  method: TeachingMethod = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const path = teachingPath(schoolId, suffix)
  if (!headers || Object.keys(headers).length === 0) {
    return schoolRequest<T>(token, path, method, body)
  }
  if (!token) throw new ApiError(401, 'Log in again to continue.')
  let response: Response
  try {
    response = await fetch(`${platformApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new ApiError(
      503,
      'Teaching services are unavailable. Your draft is still here; try again.',
    )
  }
  if (!response.ok) {
    let code: string | null = null
    let currentRevision: number | null = null
    try {
      const json = (await response.json()) as Record<string, unknown>
      const data = (json.data ?? json) as Record<string, unknown>
      const err = (json.error ?? data) as Record<string, unknown>
      const candidate = err.code ?? err.error ?? json.code
      code = typeof candidate === 'string' ? candidate : null
      const rev = err.currentRevision ?? data.currentRevision
      currentRevision = typeof rev === 'number' ? rev : null
    } catch {
      /* body is optional */
    }
    throw new TeachingApiError(
      response.status,
      statusMessage(response.status),
      code,
      currentRevision,
    )
  }
  if (response.status === 204) return undefined as T
  const json = await response.json()
  return (json.data ?? json) as T
}

/** Browser variant. Resolves the verified cookie session first, never replays a mutation after 401. */
export async function teachingBrowserRequest<T>(
  schoolId: string,
  suffix: string,
  method: TeachingMethod = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const { getSession } = await import('next-auth/react')
  let session
  try {
    session = await getSession({ broadcast: false })
  } catch {
    throw new ApiError(
      503,
      'Your session could not be checked. Your draft is still here; try again.',
    )
  }
  if (!session?.accessToken || !session.user?.id)
    throw new ApiError(401, 'Your session has expired. Log in again.')
  return teachingRequest<T>(
    session.accessToken,
    schoolId,
    suffix,
    method,
    body,
    headers,
  )
}

export type TeachingFailure = 'denied' | 'unavailable' | 'retry'

/** Maps a failed call to one of the three honest failure states every B12 screen renders. */
export function classifyTeachingError(error: unknown): { kind: TeachingFailure; message: string } {
  const status = error instanceof ApiError ? error.status : 0
  const message = error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.'
  if (status === 401 || status === 403) return { kind: 'denied', message }
  if (status === 503 || (error instanceof TeachingApiError && error.code === 'TEACHING_UNAVAILABLE')) return { kind: 'unavailable', message }
  return { kind: 'retry', message }
}

/** Fresh key per user intent; reuse the same key when retrying that intent so the server never duplicates it. */
export function newIdempotencyKey(): string {
  const cryptoRef = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID()
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** The request function shape exposed by `useTeaching().request`. */
export type TeachingRequestFn = <T>(
  suffix: string,
  method?: TeachingMethod,
  body?: unknown,
  headers?: Record<string, string>,
) => Promise<T>
