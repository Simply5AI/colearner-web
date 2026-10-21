import { NextRequest, NextResponse } from 'next/server'
import { platformApiBaseUrl } from '@/lib/api/platform-client'
import { onboardingCredential } from '@/lib/auth/onboarding-access'

export const runtime = 'nodejs'
type Context = { params: Promise<{ path?: string[] }> }

/** The only upstream operations this boundary may reach. Everything else is a 404. */
const allowlist: Record<string, readonly string[]> = {
  '': ['GET', 'PUT'], // /learn/onboarding
  complete: ['POST'], // /learn/onboarding/complete
  skip: ['POST'], // /learn/onboarding/skip
}
const maxBody = 16 * 1024
const noStore = { 'Cache-Control': 'no-store' }
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore })

/** Transport only. The product API rechecks learner, band, consent, policy and school scope. */
async function forward(request: NextRequest, context: Context) {
  const path = ((await context.params).path ?? []).join('/')
  if (!Object.prototype.hasOwnProperty.call(allowlist, path)) return reply('Unknown setup operation.', 404)
  if (!allowlist[path]!.includes(request.method)) return reply('This setup operation does not allow that method.', 405)
  const write = request.method !== 'GET'
  if (write && request.headers.get('origin') !== request.nextUrl.origin) return reply('A same-origin setup request is required.', 403)
  if (write && !(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return reply('Send setup choices as JSON.', 415)
  let body: string | undefined
  if (write) {
    body = await request.text()
    if (body.length > maxBody) return reply('The setup request is too large.', 413)
  }
  const credential = await onboardingCredential()
  if (!credential.ok) return reply(credential.status === 401 ? 'Authentication required.' : 'Choose a current school membership again.', credential.status)
  const headers: Record<string, string> = { Authorization: `Bearer ${credential.token}`, Accept: 'application/json' }
  if (write) headers['Content-Type'] = 'application/json'
  if (credential.membership) headers['X-School-Membership-Id'] = credential.membership
  try {
    const response = await fetch(`${platformApiBaseUrl()}/learn/onboarding${path ? `/${path}` : ''}`, { method: request.method, headers, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) })
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', ...noStore } })
  } catch { return reply('Setup is unavailable. Your choices are still here.', 503) }
}
export const GET = forward
export const PUT = forward
export const POST = forward
