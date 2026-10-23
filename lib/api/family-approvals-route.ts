import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { platformApiBaseUrl } from './platform-client'

// A Next.js route module may export only HTTP methods and route config; the handler lives in lib/api.
export interface FamilyApprovalsRouteContext { params: Promise<{ path?: string[] }> }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ID = new RegExp(`^${UUID}$`, 'i')
const KEY = /^[A-Za-z0-9._:-]{8,128}$/
const noStore = { 'Cache-Control': 'no-store' }
const reply = (body: unknown, status: number) => NextResponse.json(body, { status, headers: noStore })

/**
 * Exact allowlist: list, summary, one request, decide, revoke. The bearer token is read from the Auth.js session on the
 * server and never reaches the browser. Mutations need a same-origin request and an Idempotency-Key, which is forwarded.
 */
export async function familyApprovalsRoute(request: NextRequest, context: FamilyApprovalsRouteContext) {
  const { path: segments = [] } = await context.params
  const method = request.method
  const [first, second, ...rest] = segments
  let backendPath: string | null = null
  if (rest.length === 0) {
    if (method === 'GET' && !first) backendPath = '/family/approvals'
    else if (method === 'GET' && first === 'summary' && !second) backendPath = '/family/approvals/summary'
    else if (method === 'GET' && first && !second && ID.test(first)) backendPath = `/family/approvals/${first}`
    else if (method === 'POST' && first && ID.test(first) && (second === 'decision' || second === 'revoke')) backendPath = `/family/approvals/${first}/${second}`
  }
  if (!backendPath) return reply({ message: 'Not found.' }, 404)

  if (method === 'GET' && !first) {
    const state = request.nextUrl.searchParams.get('state')
    const child = request.nextUrl.searchParams.get('childProfileId')
    if (state !== 'pending' && state !== 'history') return reply({ message: 'Invalid request.' }, 400)
    if (child && !ID.test(child)) return reply({ message: 'Invalid request.' }, 400)
    backendPath += `?state=${state}${child ? `&childProfileId=${child}` : ''}`
  }

  let body: string | undefined
  let idempotencyKey: string | undefined
  if (method === 'POST') {
    if (request.headers.get('origin') !== request.nextUrl.origin) return reply({ message: 'Same-origin request required.' }, 403)
    idempotencyKey = request.headers.get('idempotency-key') ?? undefined
    if (!idempotencyKey || !KEY.test(idempotencyKey)) return reply({ message: 'Invalid request.', code: 'IDEMPOTENCY_KEY_REQUIRED' }, 400)
    const raw = await request.text()
    if (raw.length > 512) return reply({ message: 'Request too large.' }, 413)
    let parsed: unknown = {}
    try { parsed = raw ? JSON.parse(raw) : {} } catch { return reply({ message: 'Invalid request.' }, 400) }
    if (second === 'decision') {
      const decision = (parsed as { decision?: unknown } | null)?.decision
      if (decision !== 'APPROVE' && decision !== 'DECLINE') return reply({ message: 'Invalid request.' }, 400)
      body = JSON.stringify({ decision })
    } else body = '{}'
  }

  const session = await auth()
  if (!session?.accessToken) return reply({ message: 'Please sign in again to continue.' }, 401)
  let response: Response
  try {
    response = await fetch(`${platformApiBaseUrl()}${backendPath}`, {
      method, body, cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    })
  } catch { return reply({ message: 'Approvals are unavailable.' }, 503) }
  const json = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    // Only the error code and, for 409 ALREADY_DECIDED, the recorded request are relayed. Messages are written by the web app.
    const nested = json && typeof json.error === 'object' && json.error ? json.error as Record<string, unknown> : {}
    const code = typeof json?.code === 'string' ? json.code : typeof nested.code === 'string' ? nested.code : undefined
    const decided = json?.request ?? nested.request ?? (json?.data as Record<string, unknown> | undefined)?.request
    return reply({ message: 'Request failed.', ...(code ? { code } : {}), ...(response.status === 409 && decided ? { request: decided } : {}) }, response.status)
  }
  return reply({ data: json && json.data !== undefined ? json.data : json }, 200)
}
