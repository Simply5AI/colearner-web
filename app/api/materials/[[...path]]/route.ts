import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth/config'
import { platformApiBaseUrl } from '@/lib/api/platform-client'
import { FAMILY_CHILD_COOKIE } from '@/lib/auth/family-cookies'

export const runtime = 'nodejs'
type Context = { params: Promise<{ path?: string[] }> }
const resource = '[a-zA-Z0-9_-]{1,128}'
const reads = new RegExp(`^(?:|config|${resource}|${resource}/original)$`)
const writes = new RegExp(`^(?:import|bulk|${resource}/(?:retry|cancel))$`)

/** Transport only. The product API rechecks membership, learner, source, quota and action. */
async function forward(request: NextRequest, context: Context) {
  const segments = (await context.params).path ?? []
  const path = segments.join('/')
  if (!(request.method === 'GET' ? reads : writes).test(path)) return NextResponse.json({ message: 'Unknown material operation.' }, { status: 404 })
  if (request.method === 'POST' && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'A same-origin material request is required.' }, { status: 403 })
  const jar = await cookies()
  const child = jar.get(FAMILY_CHILD_COOKIE)
  const session = child === undefined ? await auth() : null
  const token = child === undefined ? session?.accessToken : child.value
  if (!token || (child === undefined && !session?.user?.id)) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 })
  const membership = child === undefined ? jar.get('colearner-school-membership')?.value : undefined
  if (membership && !/^[a-f0-9-]{36}$/i.test(membership)) return NextResponse.json({ message: 'Choose a current school membership again.' }, { status: 403 })
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const contentType = request.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType
  if (membership && /^[a-f0-9-]{36}$/i.test(membership)) headers['X-School-Membership-Id'] = membership
  try {
    const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000) }
    if (request.method !== 'GET') { init.body = request.body; init.duplex = 'half' }
    const response = await fetch(`${platformApiBaseUrl()}/materials${path ? `/${path}` : ''}${request.nextUrl.search}`, init)
    if (request.method === 'GET' && path.endsWith('/original') && response.ok) {
      // Original file bytes: pass through only the safe, fixed set of file headers.
      const out: Record<string, string> = { 'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
      const disposition = response.headers.get('content-disposition')
      if (disposition) out['Content-Disposition'] = disposition
      return new Response(response.body, { status: 200, headers: out })
    }
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ message: 'Material services are unavailable. Your draft is still here.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
export const GET = forward
export const POST = forward
