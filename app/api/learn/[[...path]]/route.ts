import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth/config'
import { platformApiBaseUrl } from '@/lib/api/platform-client'
import { FAMILY_CHILD_COOKIE } from '@/lib/auth/family-cookies'

export const runtime = 'nodejs'
type Context = { params: Promise<{ path?: string[] }> }
const resource = '[a-zA-Z0-9_-]{1,128}'
/** Only these learner reads and writes exist. Everything else is a 404 before any credential is read. */
/** B09 practice routes: the session item index is digits only. Nothing else under `practice/` exists. */
const itemIndex = '[0-9]{1,3}'
const practiceReads = `practice/(?:hub|sets/${resource}|sessions|sessions/${resource}|sessions/${resource}/items/${itemIndex}|sessions/${resource}/summary|sessions/${resource}/answer-sheet)`
const practiceWrites = `practice/(?:sets|sets/${resource}/(?:retry|cancel)|sessions|sessions/${resource}/items/${itemIndex}/(?:answer|hint|skip)|sessions/${resource}/complete|attempts/${resource}/regrade)`
/**
 * B10 Ask Co and guided homework (exact path and method pairs from the contract and the coordinator's decisions: GET and POST, plus the
 * one PUT `homework/sessions/:id/problem`). Nothing else under `co/` or `homework/` exists: no worker or internal route, no DELETE.
 */
const coReads = `co/(?:context|conversations|conversations/${resource}|conversations/${resource}/turns/${resource})`
/** DEMO-C: `co/analogies` is one synchronous AI call ("Explain it with an analogy"). */
const coWrites = `co/(?:analogies|conversations|conversations/${resource}/turns|conversations/${resource}/turns/${resource}/(?:retry|cancel))`
const homeworkReads = `homework/sessions|homework/sessions/${resource}`
const homeworkWrites = `homework/(?:sessions|sessions/${resource}/(?:restatement|steps|hint|final|final-phase|finish|abandon|retry))`
/** B11 teach-back and progress. CSV is the one non-JSON read. No worker or internal route is forwarded. */
const teachReads = `teach/context|teach/sessions/${resource}|teach/sessions/${resource}/turns/${resource}`
const teachWrites = `teach/(?:sessions|sessions/${resource}/turns)`
const progressReads = `progress|progress/export\\.csv`
/** B12 teacher lessons: exactly these two routes (read a published teacher lesson, check one answer). */
const teacherLessonRead = `plans/${resource}/topics/${resource}/teacher-lesson`
const teacherLessonCheck = `plans/${resource}/topics/${resource}/teacher-lesson/check`
/** DEMO-B learner notes ("My pages"): list/create, then edit (PATCH) and delete (DELETE) one by id. */
const reads = new RegExp(`^(?:home|overview|link-status|notes|plans/${resource}|${teacherLessonRead}|lessons/${resource}|${practiceReads}|${coReads}|${homeworkReads}|${teachReads}|${progressReads})$`)
const writes = new RegExp(`^(?:notes|enrollments/join|${teacherLessonCheck}|lessons|lessons/${resource}/(?:check|complete|retry|cancel|notes)|${practiceWrites}|${coWrites}|${homeworkWrites}|${teachWrites})$`)
/** PUTs: the B08 lesson progress and the B10 homework problem (replaced in CAPTURE). A lesson note is the only DELETE. */
const puts = new RegExp(`^(?:lessons/${resource}/progress|homework/sessions/${resource}/problem)$`)
const deletes = new RegExp(`^(?:lessons/${resource}/notes/${resource}|notes/${resource})$`)
const patches = new RegExp(`^notes/${resource}$`)
const allowed: Record<string, RegExp | undefined> = { GET: reads, POST: writes, PUT: puts, PATCH: patches, DELETE: deletes }
const overviewQuery = new Set(['q', 'subjectId', 'kind', 'status', 'cursor', 'limit'])
/** The only query strings forwarded: overview filters, the hub filters and the session-history cursor. */
const queryKeys: Record<string, Set<string> | undefined> = {
  overview: overviewQuery,
  'practice/hub': new Set(['subjectId', 'planId']),
  'practice/sessions': new Set(['cursor', 'limit']),
  'co/context': new Set(['lessonId', 'materialId', 'stepIndex']),
  'co/conversations': new Set(['cursor', 'limit']),
  'homework/sessions': new Set(['cursor', 'limit']),
  'teach/context': new Set(['practiceSessionId', 'materialId']),
  notes: new Set(['materialId', 'kind']),
}

/** Transport only. The product API rechecks membership, learner, plan ownership, age and policy. */
async function forward(request: NextRequest, context: Context) {
  const path = ((await context.params).path ?? []).join('/')
  if (!allowed[request.method]?.test(path)) return NextResponse.json({ message: 'Unknown learning operation.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (request.method !== 'GET' && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'A same-origin learning request is required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  const jar = await cookies()
  // Child presence takes precedence: an empty or revoked child selection never falls back to an adult session.
  const child = jar.get(FAMILY_CHILD_COOKIE)
  const session = child === undefined ? await auth() : null
  const token = child === undefined ? session?.accessToken : child.value
  if (!token || (child === undefined && !session?.user?.id)) return NextResponse.json({ message: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const membership = child === undefined ? jar.get('colearner-school-membership')?.value : undefined
  if (membership && !/^[a-f0-9-]{36}$/i.test(membership)) return NextResponse.json({ message: 'Choose a current school membership again.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  const csv = path === 'progress/export.csv'
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: csv ? 'text/csv' : 'application/json' }
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') headers['Content-Type'] = request.headers.get('content-type') ?? 'application/json'
  if (membership) headers['X-School-Membership-Id'] = membership
  const query = new URLSearchParams()
  const keys = request.method === 'GET' ? queryKeys[path] : undefined
  if (keys) for (const [key, value] of request.nextUrl.searchParams) if (keys.has(key)) query.append(key, value)
  try {
    const init: RequestInit = { method: request.method, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(path === 'co/analogies' ? 90000 : 30000) }
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') init.body = await request.text()
    const response = await fetch(`${platformApiBaseUrl()}/learn/${path}${query.size > 0 ? `?${query}` : ''}`, init)
    const upstreamType = response.headers.get('content-type')
    const contentType = csv && response.ok ? (upstreamType?.includes('csv') ? upstreamType : 'text/csv; charset=utf-8') : 'application/json'
    const responseHeaders: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 'no-store' }
    if (csv && response.ok) responseHeaders['Content-Disposition'] = 'attachment; filename="progress.csv"'
    return new Response(response.body, { status: response.status, headers: responseHeaders })
  } catch { return NextResponse.json({ message: 'Learning services are unavailable. Please try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
