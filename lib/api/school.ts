import { ApiError } from './client'
import { platformApiBaseUrl } from './platform-client'

import type { SchoolClass } from '@colearner/api-client'
export type {
  SchoolRole,
  SchoolWorkspace as Workspace,
  SchoolCursorPage as CursorList,
  SchoolMember,
  SchoolInvitation as Invitation,
  IssuedSchoolInvitation,
  SchoolPage as Paged,
  AcademicYear,
  SchoolTerm,
  SchoolClass,
  SchoolRosterEntry as Enrollment,
  TeachingAssignment,
  OwnTeachingAssignment,
  SchoolRosterImportPreview as ImportPreview,
  SchoolPromotionPreview as PromotionPreview,
} from '@colearner/api-client'
/** Every operation sends the session credential; workspace IDs are context, never authority. */
export async function schoolRequest<T>(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  if (!token) throw new ApiError(401, 'Log in again to continue.')
  let response: Response
  try {
    response = await fetch(`${platformApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new ApiError(
      503,
      'School services are unavailable. Your draft is still here; try again.',
    )
  }
  if (!response.ok) {
    const message =
      response.status === 403
        ? 'You do not have permission for this school or action.'
        : response.status === 401
          ? 'Your session has expired. Log in again.'
          : response.status === 409
            ? 'This action conflicts with the current record. Refresh and review before retrying.'
            : response.status === 400
              ? 'Check the supplied details and try again.'
              : 'School services are unavailable. Please try again.'
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  const json = await response.json()
  return (json.data ?? json) as T
}
export const schoolPath = (schoolId: string, suffix: string) =>
  `/schools/${encodeURIComponent(schoolId)}${suffix}`
export const classLabel = (
  item: Pick<SchoolClass, 'board' | 'grade' | 'section'> & {
    archivedAt?: string | null
  },
) =>
  `${item.board} · Class ${item.grade} ${item.section}${item.archivedAt ? ' (archived)' : ''}`
