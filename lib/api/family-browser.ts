'use client'
import { getSession } from 'next-auth/react'
import { familyRequest, FamilyError, readFamilyResponse, type FamilyMethod } from './family'

export async function familyBrowserRequest<T>(path: string, method: FamilyMethod = 'GET', body?: unknown): Promise<T> {
  let session
  try { session = await getSession({ broadcast: false }) } catch { throw new FamilyError(503, 'Your session could not be checked. Please try again.') }
  if (!session?.accessToken || !session.user?.id) throw new FamilyError(401, 'Please sign in again to continue.')
  return familyRequest<T>(session.accessToken, path, method, body)
}
/** Device and child opaque credentials never leave HttpOnly cookies. */
export async function familyDeviceRequest<T>(operation: string, method: FamilyMethod = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try { response = await fetch(`/api/family-access/${operation}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000) }) } catch { throw new FamilyError(503, 'Family services are unavailable. Please try again.') }
  return readFamilyResponse<T>(response, 'family-access')
}
