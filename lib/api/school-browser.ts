'use client'
import { getSession } from 'next-auth/react'
import { ApiError } from './client'
import { schoolRequest } from './school'

/** Resolve the current verified cookie session before dispatch, never replay a mutation after 401. */
export async function schoolBrowserRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
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
  return schoolRequest<T>(session.accessToken, path, method, body)
}
