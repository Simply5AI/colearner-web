import { NextRequest, NextResponse } from 'next/server'
import { platformApiBaseUrl } from '@/lib/api/platform-client'

const inFlightRegisterRequests = new Set<string>()

export async function POST(req: NextRequest) {
  let dedupeKey: string | null = null

  try {
    if (req.headers.get('x-colearner-proxy') === 'register-v1') {
      return NextResponse.json(
        {
          message:
            'Loop detected: proxied register request returned to web register proxy.',
        },
        { status: 508 },
      )
    }

    const body = await req.json()

    const forwardedFor = req.headers.get('x-forwarded-for') || 'unknown'
    const clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown'
    dedupeKey = `${clientIp}:${String(body?.email || '').toLowerCase()}`

    if (inFlightRegisterRequests.has(dedupeKey)) {
      return NextResponse.json(
        {
          message:
            'A registration request is already in progress for this account. Please wait.',
        },
        { status: 429 },
      )
    }
    inFlightRegisterRequests.add(dedupeKey)

    const url = `${platformApiBaseUrl()}/auth/register`

    // Prevent proxy recursion when API URL points back to this same Next.js app.
    const target = new URL(url)
    const incoming = req.nextUrl
    if (
      target.origin === incoming.origin &&
      target.pathname === incoming.pathname
    ) {
      console.error('[proxy] blocked recursive self-call:', target.toString())
      return NextResponse.json(
        {
          message:
            'Proxy misconfiguration: API URL resolves to this web app route. Set API_URL to colearner-platform backend.',
        },
        { status: 500 },
      )
    }


    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-colearner-proxy': 'register-v1',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const text = await res.text()

    const data = text
      ? JSON.parse(text)
      : { message: res.statusText }
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { message: 'Account registration is unavailable. Please try again.' },
      { status: 502 },
    )
  } finally {
    if (dedupeKey) {
      inFlightRegisterRequests.delete(dedupeKey)
    }
  }
}
