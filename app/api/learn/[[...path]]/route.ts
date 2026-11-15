import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth/config'
import { platformApiBaseUrl } from '@/lib/api/platform-client'
import { FAMILY_CHILD_COOKIE } from '@/lib/auth/family-cookies'
import { resolveTutorLoopFixture } from '@/lib/api/tutor-loop/fixtures'

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

/** TUTOR contract §4: all learner paths under `/api/v1/learn/tutor-loop/*`. */
const tutorLoopActivityKind = '(?:MATERIAL|LESSON|PRACTICE|TEACH_BACK|HOMEWORK)'
const tutorLoopReads = `tutor-loop/(?:entry|goals|goals/${resource}|exams|exams/${resource}|exams/${resource}/readiness|plans|plans/${resource}|plan-drafts/${resource}|profile|study-preferences|today|schedule|schedule/calendar\\.ics|progress|progress/export\\.csv|progress/export\\.pdf|activities/${tutorLoopActivityKind}/${resource}/next|search|library|notes|practice|practice/topics/${resource}|practice/question-sets/${resource}|practice/sessions/${resource}/items/${itemIndex}|lessons/${resource}|exam-prep|mock-builds/${resource}|mock-sittings/${resource}|mock-sittings/${resource}/items/${itemIndex}|mock-sittings/${resource}/result|mock-sittings/${resource}/review|co/context|co/sessions|co/sessions/${resource}|co/sessions/${resource}/turns/${resource}|co/memory|co/nudges)`
const tutorLoopWrites = `tutor-loop/(?:adult-consent|goals|exams|plans|plan-drafts|plan-drafts/${resource}/(?:cancel|regenerate|accept)|study-preferences/preview|schedule/(?:move-preview|replan-preview|day-off-preview)|schedule/previews/${resource}/apply|lessons|practice/question-sets|practice/sessions/${resource}/items/${itemIndex}/(?:answer|hint)|practice/sessions/${resource}/finish|mock-builds|mock-builds/${resource}/(?:cancel|start)|mock-sittings/${resource}/(?:submit|revision-preview)|co/sessions|co/sessions/${resource}/(?:close|turns)|co/sessions/${resource}/turns/${resource}/(?:retry|cancel)|co/proposals/${resource}/accept|co/memory/forget|co/nudges/${resource}/dismiss|co/find-material|co/find-material/${resource}/add)`
const tutorLoopPuts = `tutor-loop/(?:goals/order|plans/${resource}/topics/${resource}/materials/${resource}|mock-sittings/${resource}/items/${itemIndex}|co/nudges/mutes/${resource})`
const tutorLoopPatches = `tutor-loop/(?:goals/${resource}|exams/${resource}|plans/${resource}|profile|co/memory/${resource})`
const tutorLoopDeletes = `tutor-loop/(?:adult-consent|goals/${resource}|exams/${resource}|plans/${resource}/topics/${resource}/materials/${resource}|co/sessions/${resource}|co/memory/${resource})`

/** DEMO-B learner notes ("My pages"): list/create, then edit (PATCH) and delete (DELETE) one by id. */
const reads = new RegExp(`^(?:home|overview|link-status|notes|plans/${resource}|${teacherLessonRead}|lessons/${resource}|${practiceReads}|${coReads}|${homeworkReads}|${teachReads}|${progressReads}|${tutorLoopReads})$`)
const writes = new RegExp(`^(?:notes|enrollments/join|${teacherLessonCheck}|lessons|lessons/${resource}/(?:check|complete|retry|cancel|notes)|${practiceWrites}|${coWrites}|${homeworkWrites}|${teachWrites}|${tutorLoopWrites})$`)
/** PUTs: the B08 lesson progress and the B10 homework problem (replaced in CAPTURE). A lesson note is the only DELETE. */
const puts = new RegExp(`^(?:lessons/${resource}/progress|homework/sessions/${resource}/problem|${tutorLoopPuts})$`)
const deletes = new RegExp(`^(?:lessons/${resource}/notes/${resource}|notes/${resource}|${tutorLoopDeletes})$`)
const patches = new RegExp(`^(?:notes/${resource}|${tutorLoopPatches})$`)
const allowed: Record<string, RegExp | undefined> = { GET: reads, POST: writes, PUT: puts, PATCH: patches, DELETE: deletes }
const overviewQuery = new Set(['q', 'subjectId', 'kind', 'status', 'cursor', 'limit'])
/** The only query strings forwarded: overview filters, the hub filters, session-history cursors, and contract §4 tutor-loop queries. */
const queryKeys: Record<string, Set<string> | undefined> = {
  overview: overviewQuery,
  'practice/hub': new Set(['subjectId', 'planId']),
  'practice/sessions': new Set(['cursor', 'limit']),
  'co/context': new Set(['lessonId', 'materialId', 'stepIndex']),
  'co/conversations': new Set(['cursor', 'limit']),
  'homework/sessions': new Set(['cursor', 'limit']),
  'teach/context': new Set(['practiceSessionId', 'materialId']),
  notes: new Set(['materialId', 'kind']),
  'tutor-loop/goals': new Set(['includeArchived', 'cursor', 'limit']),
  'tutor-loop/exams': new Set(['cursor', 'limit']),
  'tutor-loop/plans': new Set(['goalId', 'ownership', 'query', 'groupBy', 'cursor', 'limit']),
  'tutor-loop/today': new Set(['goalId', 'availableMinutes']),
  'tutor-loop/schedule': new Set(['from', 'to', 'goalId']),
  'tutor-loop/schedule/calendar.ics': new Set(['from', 'to', 'goalId']),
  'tutor-loop/progress': new Set(['goalId', 'examId']),
  'tutor-loop/progress/export.csv': new Set(['goalId', 'examId']),
  'tutor-loop/progress/export.pdf': new Set(['goalId', 'examId']),
  'tutor-loop/search': new Set(['q', 'kind', 'goalId', 'cursor', 'limit']),
  'tutor-loop/library': new Set(['goalId', 'subjectId', 'topicId', 'sourceType', 'status', 'query', 'recentDays', 'sort', 'groupBy', 'cursor', 'limit']),
  'tutor-loop/notes': new Set(['goalId', 'materialId', 'topicId', 'query', 'kind', 'cursor', 'limit']),
  'tutor-loop/practice': new Set(['goalId']),
  'tutor-loop/exam-prep': new Set(['goalId', 'examId']),
  'tutor-loop/co/context': new Set(['kind', 'planId', 'topicId', 'materialId', 'passageRef', 'lessonId', 'stepIndex', 'sessionId', 'attemptId', 'homeworkSessionId']),
  'tutor-loop/co/sessions': new Set(['subjectRef', 'topicRef', 'planId', 'cursor', 'limit']),
  'tutor-loop/co/nudges': new Set(['screen']),
}

const dynamicGetQueryKeys: [RegExp, Set<string>][] = [
  [new RegExp(`^tutor-loop/exams/${resource}/readiness$`), new Set(['from', 'to'])],
  [new RegExp(`^tutor-loop/plans/${resource}$`), new Set(['goalId'])],
  [new RegExp(`^tutor-loop/practice/topics/${resource}$`), new Set(['goalId'])],
  [new RegExp(`^tutor-loop/co/sessions/${resource}$`), new Set(['cursor', 'limit'])],
]

const deleteRevisionPaths = new RegExp(`^tutor-loop/(?:goals/${resource}|exams/${resource}|co/memory/${resource})$`)

function resolveAllowedQueryKeys(method: string, path: string): Set<string> | undefined {
  if (method === 'GET') {
    const exact = queryKeys[path]
    if (exact) return exact
    for (const [pattern, set] of dynamicGetQueryKeys) {
      if (pattern.test(path)) return set
    }
    return undefined
  }
  if (method === 'DELETE' && deleteRevisionPaths.test(path)) {
    return new Set(['revision'])
  }
  return undefined
}

/** Transport only. The product API rechecks membership, learner, plan ownership, age and policy. */
async function forward(request: NextRequest, context: Context) {
  const path = ((await context.params).path ?? []).join('/')
  if (!allowed[request.method]?.test(path)) return NextResponse.json({ message: 'Unknown learning operation.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (request.method !== 'GET' && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'A same-origin learning request is required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  const jar = await cookies()
  const isTutorLoop = path.startsWith('tutor-loop/')
  const requestedWorkspace = request.headers.get('x-tutor-workspace')?.toLowerCase()
  // Child presence takes precedence: an empty or revoked child selection never falls back to an adult session.
  const child = jar.get(FAMILY_CHILD_COOKIE)
  if (child !== undefined && requestedWorkspace === 'personal') {
    return NextResponse.json({ code: 'POLICY_BLOCKED', message: 'Personal workspace is not available for a child session.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const session = child === undefined ? await auth() : null
  const token = child === undefined ? session?.accessToken : child.value
  if (!token || (child === undefined && !session?.user?.id)) return NextResponse.json({ message: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const membership = child === undefined ? jar.get('colearner-school-membership')?.value : undefined
  if (membership && !/^[a-f0-9-]{36}$/i.test(membership)) return NextResponse.json({ message: 'Choose a current school membership again.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })

  const cookieWorkspace = child === undefined ? jar.get('colearner-tutor-workspace')?.value : undefined
  const usePersonalWorkspace = isTutorLoop && child === undefined && (
    requestedWorkspace === 'personal' ||
    (requestedWorkspace !== 'school' && !membership && cookieWorkspace === 'personal')
  )

  const csv = path === 'progress/export.csv' || path === 'tutor-loop/progress/export.csv'
  const pdf = path === 'tutor-loop/progress/export.pdf'
  const ics = path === 'tutor-loop/schedule/calendar.ics'
  const acceptHeader = csv ? 'text/csv' : pdf ? 'application/pdf' : ics ? 'text/calendar' : 'application/json'
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: acceptHeader }
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') headers['Content-Type'] = request.headers.get('content-type') ?? 'application/json'
  if (usePersonalWorkspace) {
    headers['X-Tutor-Workspace'] = 'personal'
  } else if (membership) {
    headers['X-School-Membership-Id'] = membership
  }

  const query = new URLSearchParams()
  const keys = resolveAllowedQueryKeys(request.method, path)
  if (keys) for (const [key, value] of request.nextUrl.searchParams) if (keys.has(key)) query.append(key, value)

  if (isTutorLoop && process.env.TUTOR_LOOP_USE_FIXTURES === 'true') {
    const resolved = resolveTutorLoopFixture(request.method, path.slice('tutor-loop'.length))
    if (resolved) {
      if (ics && typeof (resolved.body as { body?: unknown })?.body === 'string') {
        return new Response((resolved.body as { body: string }).body, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="colearner-schedule.ics"', 'Cache-Control': 'no-store' },
        })
      }
      if (csv && typeof (resolved.body as { body?: unknown })?.body === 'string') {
        return new Response((resolved.body as { body: string }).body, {
          status: 200,
          headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="progress.csv"', 'Cache-Control': 'no-store' },
        })
      }
      if (pdf && typeof (resolved.body as { body?: unknown })?.body === 'string') {
        const bytes = Buffer.from((resolved.body as { body: string }).body, 'base64')
        return new Response(bytes, {
          status: 200,
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="progress.pdf"', 'Cache-Control': 'no-store' },
        })
      }
      return NextResponse.json({ data: resolved.body }, { status: resolved.status, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  try {
    const init: RequestInit = { method: request.method, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(path === 'co/analogies' ? 90000 : 30000) }
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') init.body = await request.text()
    const response = await fetch(`${platformApiBaseUrl()}/learn/${path}${query.size > 0 ? `?${query}` : ''}`, init)
    const upstreamType = response.headers.get('content-type')
    const contentType = csv && response.ok
      ? (upstreamType?.includes('csv') ? upstreamType : 'text/csv; charset=utf-8')
      : pdf && response.ok
        ? (upstreamType?.includes('pdf') ? upstreamType : 'application/pdf')
        : ics && response.ok
          ? (upstreamType?.includes('calendar') ? upstreamType : 'text/calendar; charset=utf-8')
          : 'application/json'
    const responseHeaders: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 'no-store' }
    if (csv && response.ok) responseHeaders['Content-Disposition'] = 'attachment; filename="progress.csv"'
    if (pdf && response.ok) responseHeaders['Content-Disposition'] = 'attachment; filename="progress.pdf"'
    if (ics && response.ok) responseHeaders['Content-Disposition'] = 'attachment; filename="colearner-schedule.ics"'
    return new Response(response.body, { status: response.status, headers: responseHeaders })
  } catch { return NextResponse.json({ message: 'Learning services are unavailable. Please try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
