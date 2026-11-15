import 'server-only'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth/config'
import { FAMILY_CHILD_COOKIE } from '@/lib/auth/family-cookies'
import { platformApiBaseUrl } from '@/lib/api/platform-client'

const icon = z.enum(['BUDDY', 'CLOUD', 'SPARK', 'SPROUT'])
const capabilities = z.object({
  canCreatePersonalPlan: z.boolean(),
  canUseTutor: z.boolean(),
  canUseMock: z.boolean(),
  canUseMemory: z.boolean(),
  findMaterial: z.enum(['HIDDEN', 'LOCKED', 'UNAVAILABLE', 'AVAILABLE']),
})
const entrySchema = z.object({
  needsOnboarding: z.boolean(),
  needsConsent: z.boolean(),
  capabilities,
  tutorIdentity: z.object({ name: z.string(), icon }).nullable(),
}).and(z.union([
  z.object({ band: z.literal('14-17'), scope: z.literal('SCHOOL') }),
  z.object({ band: z.literal('18+'), scope: z.literal('PERSONAL') }),
]))

export type TutorEntry = z.infer<typeof entrySchema>
export type TutorWorkspace = 'school' | 'personal'
export type TutorCredential = { token: string; membership?: string; name: string | null }

export async function tutorCredential(workspace: TutorWorkspace): Promise<TutorCredential | null> {
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined) {
    return workspace === 'school' && child.value ? { token: child.value, name: null } : null
  }
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) return null
  const membership = workspace === 'school' ? jar.get('colearner-school-membership')?.value : undefined
  if (membership && !z.string().uuid().safeParse(membership).success) return null
  const name = session.user.name?.trim().split(/\s+/)[0]?.slice(0, 30) || null
  return { token: session.accessToken, membership, name }
}

async function request(
  credential: TutorCredential, workspace: TutorWorkspace, path: '/entry' | '/adult-consent' | '/goals', body?: unknown,
) {
  const headers = new Headers({ Authorization: `Bearer ${credential.token}`, Accept: 'application/json' })
  if (workspace === 'personal') headers.set('X-Tutor-Workspace', 'personal')
  if (workspace === 'school' && credential.membership) headers.set('X-School-Membership-Id', credential.membership)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${platformApiBaseUrl()}/learn/tutor-loop${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  })
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => null) as unknown }
}

const envelope = <T extends z.ZodType>(data: T) => z.object({ data })

export async function readTutorEntry(credential: TutorCredential, workspace: TutorWorkspace) {
  try {
    const result = await request(credential, workspace, '/entry')
    if (!result.ok) {
      const { data } = z.object({ code: z.string().optional() }).safeParse(result.json)
      if (result.status === 401) return { state: 'signed-out' as const }
      if (result.status === 403 && data?.code === 'TUTOR_NOT_ENABLED') return { state: 'disabled' as const }
      if (result.status === 403) return { state: 'denied' as const }
      return { state: 'unavailable' as const }
    }
    const { data } = envelope(entrySchema).safeParse(result.json)
    if (data && data.data.scope === (workspace === 'personal' ? 'PERSONAL' : 'SCHOOL')) {
      return { state: 'ready' as const, entry: data.data }
    }
    return { state: 'unavailable' as const }
  } catch {
    return { state: 'unavailable' as const }
  }
}

export async function grantTutorLearningConsent(credential: TutorCredential, clientRequestId: string) {
  if (!z.string().uuid().safeParse(clientRequestId).success) return false
  const result = await request(credential, 'personal', '/adult-consent', {
    policyVersion: 'tutor-personal-1', processorRef: null, scopes: ['LEARN'], clientRequestId,
  })
  return result.ok && envelope(z.object({ state: z.literal('ACTIVE') })).safeParse(result.json).success
}
