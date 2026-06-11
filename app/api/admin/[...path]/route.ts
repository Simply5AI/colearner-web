import { NextRequest, NextResponse } from 'next/server'
import { callBackend } from '@/lib/api/admin-bff'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie'

type RouteContext = { params: Promise<{ path: string[] }> }

/** Clients may accidentally include `api/admin` in the BFF URL; strip before proxying. */
function normalizeAdminPathSegments(segments: string[]): string[] {
  if (segments[0] === 'api' && segments[1] === 'admin') {
    return segments.slice(2)
  }
  return segments
}

async function proxyAdmin(req: NextRequest, pathSegments: string[]) {
  const sid = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!sid) {
    return NextResponse.json({ message: 'Admin session required' }, { status: 401 })
  }

  const resource = normalizeAdminPathSegments(pathSegments).join('/')
  const path = `/api/admin/${resource}${req.nextUrl.search}`
  const method = req.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? await req.text() : undefined

  const result = await callBackend(path, {
    method,
    body: body || undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    cookie: `${ADMIN_SESSION_COOKIE}=${sid}`,
  })

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message ?? 'Request failed', code: result.code },
      { status: result.status }
    )
  }

  return NextResponse.json(result.data)
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyAdmin(req, path)
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyAdmin(req, path)
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyAdmin(req, path)
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyAdmin(req, path)
}