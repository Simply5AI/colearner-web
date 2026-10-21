import type { LearnBand } from '@/lib/api/learn'
import type { LessonDetail } from '@/lib/api/lesson'
import { answerKeys, apiBandFor, fixtureLessonId, fixtureMaterialId, lessonContentFixture, lessonDetailFixture } from './lesson-fixtures'

/*
 * A stand-in for the B08 lesson endpoints (platform agent LD was built in parallel to the contract). It is used by the
 * integration tests (through a stubbed fetch), by /dev/lesson, and by the Playwright review (through page.route).
 * It follows the contract: the learner payload never carries the answer, only a correct pick reveals it, progress is
 * optimistic by revision, and complete needs all five steps. It is a test double, never production behaviour.
 */
export type MockState = 'ready' | 'generating' | 'failed' | 'failed-final' | 'cancelled' | 'access-changed' | 'done' | 'denied' | 'unavailable' | 'loading'
export interface MockOptions {
  band: LearnBand
  state?: MockState
  step?: number
  completed?: number[]
  notes?: boolean
  /** Number of GETs before a generating lesson becomes ready (the first is QUEUED, the next RUNNING). */
  generatingPolls?: number
  /** Number of progress writes that fail with 503 before one succeeds. */
  progressFailures?: number
  /** One progress write answers 409 PROGRESS_CONFLICT (another device moved the lesson). */
  conflictOnce?: boolean
  /** Access to the lesson is withdrawn on the first progress write (403 LESSON_ACCESS_CHANGED), and the lesson is hidden after that. */
  revokeOnProgress?: boolean
  /** Error code returned by POST /lessons (for example CONSENT_REQUIRED). */
  startError?: string
  /** Milliseconds every answer is delayed by. */
  delayMs?: number
}
export interface MockCall { method: string; path: string; body: unknown }
export interface MockReply { status: number; body: unknown }

const startErrors: Record<string, { status: number; message: string }> = {
  MATERIAL_NOT_READY: { status: 409, message: 'The material is not ready.' },
  CONSENT_REQUIRED: { status: 403, message: 'Consent is required.' },
  CHILD_PROFILE_REQUIRED: { status: 403, message: 'A child profile is required.' },
  POLICY_BLOCKED: { status: 403, message: 'Lessons are paused until tomorrow because today’s learning time is used up.' },
  LESSONS_UNAVAILABLE: { status: 409, message: 'Lessons are not enabled.' },
  DAILY_LESSON_LIMIT: { status: 429, message: 'Daily lesson limit reached.' },
}
const ok = (data: unknown, status = 200): MockReply => ({ status, body: { statusCode: status, data, timestamp: '2026-10-19T09:00:00.000Z' } })
const fail = (status: number, code: string, message = 'Request refused.'): MockReply => ({ status, body: { statusCode: status, code, message } })
const NOW = '2026-10-19T09:30:00.000Z'

export function createLessonMock(options: MockOptions) {
  const { band } = options
  const key = answerKeys[band]
  const content = lessonContentFixture(band)
  const state = options.state ?? 'ready'
  const calls: MockCall[] = []
  let detail: LessonDetail = lessonDetailFixture(band, {
    status: state === 'generating' || state === 'loading' ? 'QUEUED' : state === 'failed' || state === 'failed-final' ? 'FAILED' : state === 'cancelled' ? 'CANCELLED' : 'READY',
    failure: state === 'access-changed' ? { code: 'LESSON_ACCESS_CHANGED', retryable: false } : state === 'failed' ? { code: 'generation_failed', retryable: true } : state === 'failed-final' ? { code: 'insufficient_source', retryable: false } : null,
    content: state === 'access-changed' ? null : undefined,
    currentStep: options.step ?? (state === 'done' ? 4 : 0),
    completedSteps: options.completed ?? (state === 'done' ? [0, 1, 2, 3, 4] : []),
    completedAt: state === 'done' ? NOW : null,
    notes: options.notes ? [{ id: 'note-1', stepIndex: 1, text: 'Remember: the bottom number stays the same.', createdAt: '2026-10-19T09:10:00.000Z' }] : [],
  })
  let revision = 0
  let polls = 0
  let created = false
  let progressFailures = options.progressFailures ?? 0
  let conflictOnce = options.conflictOnce ?? false
  let attempts = 0
  let regenerating = false
  let noteSeq = detail.notes.length
  const hidden = () => detail.lesson.status === 'READY' && detail.content === null
  const snapshot = (): LessonDetail => ({ ...detail, progress: { ...detail.progress, revision }, notes: [...detail.notes] })

  const handle = (method: string, rawPath: string, body: unknown): MockReply => {
    const path = rawPath.split('?')[0]!.replace(/^\/api\/learn/, '')
    calls.push({ method, path, body })
    const parts = path.split('/').filter(Boolean)
    if (parts[0] !== 'lessons') return fail(404, 'NOT_FOUND')
    if (method === 'POST' && parts.length === 1) {
      if (options.startError) { const failure = startErrors[options.startError] ?? { status: 400, message: 'Refused.' }; return { status: failure.status, body: { statusCode: failure.status, code: options.startError, message: failure.message } } }
      // The platform keeps a cancelled lesson as history and answers a new request with the next version.
      if (detail.lesson.status === 'CANCELLED') { created = false; polls = 0; regenerating = true; detail = { ...detail, lesson: { ...detail.lesson, id: `${fixtureLessonId}-v${detail.lesson.version + 1}`, version: detail.lesson.version + 1, status: 'QUEUED', failure: null }, content: null } }
      const first = !created; created = true
      return ok({ lesson: detail.lesson }, first ? 201 : 200)
    }
    if (state === 'denied') return fail(404, 'NOT_FOUND')
    if (state === 'unavailable') return fail(503, 'SERVICE_UNAVAILABLE')
    if (parts[1] !== fixtureLessonId && parts[1] !== detail.lesson.id) return fail(404, 'NOT_FOUND')
    const action = parts[2]
    // Hidden lesson (access changed): every action is refused with the same typed code.
    if (method !== 'GET' && hidden()) return fail(403, 'LESSON_ACCESS_CHANGED')
    if (method === 'GET' && parts.length === 2) {
      if ((state === 'generating' || regenerating) && detail.lesson.status !== 'READY' && detail.lesson.status !== 'CANCELLED') {
        polls += 1
        const ready = polls >= (options.generatingPolls ?? 3)
        detail = { ...detail, lesson: { ...detail.lesson, status: ready ? 'READY' : polls === 1 ? 'QUEUED' : 'RUNNING', readyAt: ready ? NOW : null }, content: ready ? content : null, generatedBy: ready ? { kind: 'AI', packVersion: '0.1.2', promptRelease: 'lesson-fixture-1' } : detail.generatedBy }
      }
      return ok(snapshot())
    }
    if (method === 'PUT' && action === 'progress') {
      const input = body as { currentStep: number; completedStep?: number; revision: number }
      if (options.revokeOnProgress) { detail = { ...detail, content: null, notes: [], lesson: { ...detail.lesson, failure: { code: 'LESSON_ACCESS_CHANGED', retryable: false } } }; return fail(403, 'LESSON_ACCESS_CHANGED') }
      if (progressFailures > 0) { progressFailures -= 1; return fail(503, 'SERVICE_UNAVAILABLE') }
      const conflict = (): MockReply => ({ status: 409, body: { statusCode: 409, code: 'PROGRESS_CONFLICT', message: 'Your progress changed somewhere else. Reload to continue.', progress: { ...detail.progress, revision } } })
      if (conflictOnce) { conflictOnce = false; revision += 1; return conflict() }
      if (input.revision !== revision) return conflict()
      const done = new Set(detail.progress.completedSteps)
      const wanted = new Set(done)
      if (input.completedStep !== undefined) wanted.add(input.completedStep)
      // The platform's order rules: steps are completed in order and the current step never passes the first unfinished one.
      if (input.completedStep !== undefined && !done.has(input.completedStep)) for (let earlier = 0; earlier < input.completedStep; earlier++) if (!done.has(earlier)) return fail(409, 'STEP_ORDER', 'Finish the steps in order.')
      let frontier = 0
      while (frontier < 4 && wanted.has(frontier)) frontier += 1
      if (input.currentStep > frontier) return fail(409, 'STEP_ORDER', 'Finish the steps in order.')
      const completedSteps = [...wanted].sort()
      const changed = completedSteps.length !== detail.progress.completedSteps.length || input.currentStep !== detail.progress.currentStep
      detail.progress = { ...detail.progress, currentStep: input.currentStep, completedSteps }
      if (changed) revision += 1
      // Like the platform: the receipt wraps the progress.
      return ok({ progress: { ...detail.progress, revision } })
    }
    if (method === 'POST' && action === 'check') {
      const input = body as { stepIndex: number; optionId: string }
      const option = key.options.find(item => item.id === input.optionId)
      if (input.stepIndex !== 2 || !option) return fail(400, 'BAD_REQUEST')
      attempts += 1
      const correct = option.id === key.correctOptionId
      return ok({ correct, feedback: option.feedback, correctOptionId: correct ? key.correctOptionId : null, attempt: attempts })
    }
    if (method === 'POST' && action === 'complete') {
      if (detail.progress.completedSteps.length < 5) return fail(409, 'LESSON_INCOMPLETE')
      detail.progress = { ...detail.progress, completedAt: detail.progress.completedAt ?? NOW }
      return ok(snapshot())
    }
    if (method === 'POST' && action === 'retry') {
      if (detail.lesson.status !== 'FAILED' || !detail.lesson.failure?.retryable) return fail(409, 'NOT_RETRYABLE')
      polls = 0; regenerating = true
      // A retry creates the NEXT VERSION (new id) which behaves like a freshly queued lesson.
      detail = { ...detail, lesson: { ...detail.lesson, id: `${fixtureLessonId}-v2`, version: detail.lesson.version + 1, status: 'QUEUED', failure: null }, content: null }
      return ok({ lesson: detail.lesson }, 201)
    }
    if (method === 'POST' && action === 'cancel') {
      detail = { ...detail, lesson: { ...detail.lesson, status: 'CANCELLED' }, content: null }
      return ok({ lesson: detail.lesson })
    }
    if (method === 'POST' && action === 'notes') {
      if (apiBandFor(band) === '6-9') return fail(403, 'NOTES_NOT_AVAILABLE')
      const input = body as { stepIndex: number; text?: string; termIndex?: number }
      const term = input.termIndex === undefined ? null : content.keyTerms[input.termIndex]
      const text = term ? `${term.term}: ${term.definition}` : (input.text ?? '')
      if (!text || text.length > 500) return fail(400, 'BAD_REQUEST')
      noteSeq += 1
      const note = { id: `note-${noteSeq}`, stepIndex: input.stepIndex, text, createdAt: NOW }
      detail = { ...detail, notes: [...detail.notes, note] }
      return ok({ note }, 201)
    }
    if (method === 'DELETE' && action === 'notes' && parts[3]) {
      detail = { ...detail, notes: detail.notes.filter(note => note.id !== parts[3]) }
      return ok({ deleted: true })
    }
    return fail(404, 'NOT_FOUND')
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/learn/lessons')) return new Response(JSON.stringify({ message: 'Not mocked' }), { status: 404 })
    if (state === 'loading') return new Promise<Response>(() => undefined)
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown
    if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body)
    const reply = handle(method, url.pathname + url.search, body)
    return reply.status === 204 ? new Response(null, { status: 204 }) : new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } })
  }

  return { calls, handle, fetch: mockFetch, snapshot, get detail() { return snapshot() }, ids: { lessonId: fixtureLessonId, materialId: fixtureMaterialId } }
}
export type LessonMock = ReturnType<typeof createLessonMock>
