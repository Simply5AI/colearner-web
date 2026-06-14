import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { callBackend } from '@/lib/api/admin-bff'

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxyStudent(req: NextRequest, pathSegments: string[]) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const resource = pathSegments.join('/')
  const path = `/api/student/${resource}${req.nextUrl.search}`
  const method = req.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? await req.text() : undefined

  const result = await callBackend(path, {
    method,
    body: body || undefined,
    bearer: session.accessToken,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
  })

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message ?? 'Request failed', code: result.code },
      { status: result.status },
    )
  }

  return NextResponse.json(result.data, { status: result.status })
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyStudent(req, path)
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyStudent(req, path)
}