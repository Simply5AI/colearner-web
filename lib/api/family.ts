import { ApiError } from './client'
import { platformApiBaseUrl } from './platform-client'

import type { FamilyPreferenceSettings } from '@colearner/api-client'
export type { FamilyAgeCheck as AgeCheck, GuardianHandoff as Handoff, FamilyConsentNotice as ConsentNotice, FamilyChild, GuardianInvitationInspection as GuardianInvitation, SchoolGuardians as GuardianRecords, FamilyDeviceProfile as DeviceProfile, FamilySchoolPolicy as SchoolPolicy, FamilyEffectivePolicy as EffectivePolicy, FamilyChildContext as ChildContext } from '@colearner/api-client'
/**
 * B10 stricter-wins flags for Ask Co and homework help (school policy and guardian preference settings). The vendored
 * 0.4.0 types predate them, so they are optional here: an older saved row without them means the platform defaults
 * (allowed, up to 3 hints).
 */
export type HomeworkHintsMax = 0 | 1 | 2 | 3
export interface CoPolicyFlags { askCoAllowed?: boolean; homeworkHelpAllowed?: boolean; homeworkHintsMax?: HomeworkHintsMax }
export const coPolicyDefaults = { askCoAllowed: true, homeworkHelpAllowed: true, homeworkHintsMax: 3 } as const
/** Form-only editing shape: education version is omitted for guardian preferences. */
export type PolicySettings = FamilyPreferenceSettings & CoPolicyFlags & { educationPackVersion?: string | null }
export type FamilyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export class FamilyError extends ApiError {
  constructor(status: number, message: string, readonly code?: string, readonly credentialScope: 'account' | 'family-access' = 'account') { super(status, message) }
}
export async function readFamilyResponse<T>(response: Response, credentialScope: 'account' | 'family-access' = 'account'): Promise<T> {
  const json: unknown = await response.json().catch(() => null)
  const record = json && typeof json === 'object' ? json as Record<string, unknown> : {}
  if (!response.ok) {
    const code = typeof record.code === 'string' ? record.code : undefined
    const safe = code === 'PIN_INCORRECT' ? 'Oops! Those pictures did not match. Try again.' : response.status === 429 || code === 'PIN_HELP_REQUIRED'
      ? 'Ask your grown-up for help. Picture entry is temporarily locked. Try again after 15 minutes.'
      : response.status === 401 ? 'Please sign in again to continue.'
        : response.status === 403 ? 'This action needs a verified guardian, current consent and permission for this child or school.'
          : response.status === 409 ? 'This record has changed or the invitation was already used. Refresh and review before trying again.'
            : response.status === 400 ? 'Check the details and try again. Your entries are still here.'
              : 'Family services are unavailable. Your entries are still here; please try again.'
    throw new FamilyError(response.status, safe, code, credentialScope)
  }
  return (record.data ?? json) as T
}
export async function familyRequest<T>(token: string, path: string, method: FamilyMethod = 'GET', body?: unknown): Promise<T> {
  if (!token) throw new FamilyError(401, 'Please sign in again to continue.')
  let response: Response
  try {
    response = await fetch(`${platformApiBaseUrl()}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000) })
  } catch { throw new FamilyError(503, 'Family services are unavailable. Your entries are still here; please try again.') }
  return readFamilyResponse<T>(response)
}
