import { createMockTeaching, type MockResponse } from '../plans/mock-server'
import {
  authorOnlyTypes, contentForType, normaliseContent, validateQuestion, type QuestionContent, type QuestionDetail, type QuestionFlag, type QuestionType,
} from '@/lib/api/teaching/question-schema'

/*
 * DEVELOPMENT FIXTURE ONLY (B13 W1). An in-memory stand-in for the platform question bank routes (contract sections 6.1 to 6.3),
 * built on the B12 plan fixture. Every question, "Co draft" and flag below is a hand-written synthetic fixture so the screens can
 * be exercised without the platform, a database or a model. It is never imported by production code.
 */
type Json = Record<string, unknown>
const iso = (offsetMs = 0) => new Date(Date.UTC(2026, 9, 31, 8, 0, 0) + offsetMs).toISOString()
const ok = (body: unknown, status = 200): MockResponse => ({ status, body: { statusCode: status, data: body, timestamp: iso() } })
const fail = (status: number, code: string, extra: Json = {}): MockResponse => ({ status, body: { statusCode: status, code, message: code, ...extra } })

interface Row { detail: QuestionDetail; plan: string }
interface Batch { id: string; planId: string; topicId: string; status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED'; polls: number; ids: string[]; failureCode: string | null; topicTitle: string; materialTitles: string[] }

const TOPICS: Record<string, { plan: string; planTitle: string; title: string }> = {
  'topic-parts': { plan: 'plan-fractions', planTitle: 'Grade 6 Fractions', title: 'Parts of a whole' },
  'topic-add': { plan: 'plan-fractions', planTitle: 'Grade 6 Fractions', title: 'Adding fractions' },
  'topic-compare': { plan: 'plan-fractions', planTitle: 'Grade 6 Fractions', title: 'Comparing fractions' },
  'a-topic-1': { plan: 'plan-algebra', planTitle: 'Grade 6 Algebra Basics', title: 'Variables' },
  'a-topic-2': { plan: 'plan-algebra', planTitle: 'Grade 6 Algebra Basics', title: 'Simple equations' },
}

/** `state`: default, empty, denied, error, co-unavailable, conflict, batch-running (QUEUED, RUNNING, then READY), batch-failed, slow. */
export function createMockQuestions(state = 'default') {
  const base = createMockTeaching('default')
  base.materials.push({ id: 'mat-photo-1', topicId: 'topic-parts', type: 'IMAGE', title: 'Pizza cut in 8 (photo)', description: null, status: 'PUBLISHED', downloadable: false, visibility: 'PREVIEW', sortOrder: 5, externalUrl: null, mimeType: 'image/png', sizeBytes: 1000, hasFile: true, createdAt: iso(), updatedAt: iso() } as never)
  base.materials.push({ id: 'mat-photo-2', topicId: 'topic-parts', type: 'IMAGE', title: 'Chocolate bar in 4 (photo)', description: null, status: 'PUBLISHED', downloadable: false, visibility: 'PREVIEW', sortOrder: 6, externalUrl: null, mimeType: 'image/png', sizeBytes: 1000, hasFile: true, createdAt: iso(), updatedAt: iso() } as never)

  const rows = new Map<string, Row>()
  const batches = new Map<string, Batch>()
  let counter = 100
  let putCount = 0
  const nextId = (prefix: string) => `${prefix}-${++counter}`

  function make(id: string, topicId: string, c: QuestionContent, extra: Partial<QuestionDetail> = {}): QuestionDetail {
    const topic = TOPICS[topicId]!
    const detail: QuestionDetail = {
      id, planId: topic.plan, planTitle: topic.planTitle, topicId, topicTitle: topic.title, type: c.type, difficulty: c.difficulty, status: 'PUBLISHED', reviewState: 'NONE', origin: 'MANUAL',
      version: 1, promptPreview: c.prompt.slice(0, 160), hasDraftRevision: false, successRate: null, flags: [], authorOnly: authorOnlyTypes.includes(c.type), updatedAt: iso(-3_600_000),
      content: c, draftRevision: null, revisions: [{ revision: 1, state: 'PUBLISHED', publishedAt: iso(-86_400_000), publishedBy: 'teacher-1' }],
      provenance: { origin: 'MANUAL', packVersion: null, promptRelease: null, traceId: null, batchId: null, importId: null, authoredBy: 'teacher-1', reviewedBy: null, reviewedAt: null, approvedBy: 'teacher-1' },
      ...extra,
    }
    rows.set(id, { detail, plan: topic.plan })
    return detail
  }
  const withOptions = (type: QuestionType, topicId: string, prompt: string, labels: string[], correct: number[], difficulty: QuestionContent['difficulty'] = 'EASY') => {
    const c = contentForType(type, { topicId })
    const options = labels.map((label, i) => ({ id: `o${i + 1}`, label }))
    return { ...c, prompt, difficulty, options, correctAnswer: type === 'MULTI_SELECT' ? { kind: 'options' as const, optionIds: correct.map(i => `o${i + 1}`) } : type === 'ORDERING' ? { kind: 'order' as const, optionIds: options.map(o => o.id) } : { kind: 'option' as const, optionId: `o${correct[0]! + 1}` }, explanation: 'Fixture explanation.' }
  }

  if (state !== 'empty') {
    make('q-1', 'topic-add', withOptions('MCQ', 'topic-add', 'Which fraction is bigger, 3/8 or 5/8?', ['3/8', '5/8', 'They are equal', 'Cannot tell'], [1]), { successRate: { value: 0.72, attempts: 18 } })
    make('q-2', 'topic-add', { ...contentForType('SHORT_ANSWER', { topicId: 'topic-add' }), prompt: 'Explain why 1/2 + 1/3 is not 2/5.', difficulty: 'MEDIUM', correctAnswer: { kind: 'text', sample: 'Denominators must match before adding.' }, rubric: 'Mentions a common denominator.' },
      { status: 'DRAFT', successRate: null, revisions: [], flags: [{ id: 'f-1', kind: 'AMBIGUOUS', source: 'CO', note: 'It is unclear whether "not" asks for a proof or a calculation.', relatedQuestionId: null }] })
    make('q-3', 'topic-parts', { ...contentForType('FILL_BLANK', { topicId: 'topic-parts' }), prompt: 'A fraction with the same top and bottom is equal to ___.', difficulty: 'EASY', correctAnswer: { kind: 'blanks', blanks: [['1', 'one']] } },
      { successRate: { value: 0.91, attempts: 40 }, flags: [{ id: 'f-2', kind: 'DUPLICATE', source: 'DETERMINISTIC', note: 'Very close to "A fraction with equal top and bottom is ___."', relatedQuestionId: 'q-9' }] })
    make('q-4', 'topic-compare', withOptions('ORDERING', 'topic-compare', 'Put these fractions in order, smallest first.', ['1/4', '1/3', '1/2', '3/4'], [0], 'MEDIUM'), { origin: 'MANUAL' })
    make('q-5', 'topic-parts', { ...contentForType('TRUE_FALSE', { topicId: 'topic-parts' }), prompt: '3/4 means 3 parts out of 4 equal parts.', difficulty: 'EASY' }, { origin: 'CSV', provenance: { origin: 'CSV', packVersion: null, promptRelease: null, traceId: null, batchId: null, importId: 'imp-1', authoredBy: 'teacher-1', reviewedBy: null, reviewedAt: null, approvedBy: 'teacher-1' } })
    make('q-6', 'a-topic-1', { ...contentForType('CODE', { topicId: 'a-topic-1' }), prompt: 'Write a function that returns x + 1.', difficulty: 'MEDIUM', correctAnswer: { kind: 'code', sample: 'def f(x):\n    return x + 1', language: 'python' }, media: { language: 'python', starterCode: 'def f(x):\n    ' } })
    make('q-7', 'topic-parts', withOptions('MCQ', 'topic-parts', 'Which fraction of the pizza is left? (A fixture question with an unpublished edit.)', ['1/8', '3/8', '5/8', '7/8'], [2]), {
      hasDraftRevision: true, successRate: { value: 0.5, attempts: 6 },
      draftRevision: { revision: 2, content: withOptions('MCQ', 'topic-parts', 'Which fraction of the pizza is left now?', ['1/8', '3/8', '5/8', '7/8'], [2]), updatedAt: iso(-1_800_000) },
      revisions: [{ revision: 1, state: 'PUBLISHED', publishedAt: iso(-86_400_000), publishedBy: 'teacher-1' }, { revision: 2, state: 'DRAFT', publishedAt: null, publishedBy: null }],
    })
    make('q-8', 'topic-add', withOptions('MULTI_SELECT', 'topic-add', 'Which of these equal 1/2?', ['2/4', '3/6', '2/3', '4/8'], [0, 1, 3], 'MEDIUM'), { status: 'ARCHIVED', successRate: { value: 0.33, attempts: 12 } })
    make('q-9', 'topic-parts', { ...contentForType('SHORT_ANSWER', { topicId: 'topic-parts' }), prompt: 'A fraction with equal top and bottom is ___.', difficulty: 'EASY', correctAnswer: { kind: 'text', sample: 'One.' }, rubric: 'Says one or 1.' }, { status: 'DRAFT', revisions: [], flags: [{ id: 'f-3', kind: 'DUPLICATE', source: 'DETERMINISTIC', note: 'Close to a published question.', relatedQuestionId: 'q-3' }] })
  }

  // A fixture batch (batch-101) so the review view has something to show; state batch-running/batch-failed shape its status.
  const seedBatch = () => { if (state !== 'empty') makeBatch('plan-fractions', { topicId: 'topic-add', materialIds: ['mat-pdf'], count: 4 }) }

  const item = (d: QuestionDetail) => {
    const { content: _c, draftRevision: _d, revisions: _r, provenance: _p, ...rest } = d
    void _c; void _d; void _r; void _p
    return rest
  }
  const touch = (d: QuestionDetail) => { d.updatedAt = new Date().toISOString(); d.promptPreview = (d.draftRevision?.content ?? d.content).prompt.slice(0, 160) }

  function coState() {
    const unavailable = state === 'co-unavailable'
    const ai = unavailable ? { state: 'UNAVAILABLE', reason: 'Co question drafting is switched off for your school. Ask your administrator.', code: 'FLAG_OFF' } : { state: 'AVAILABLE', reason: null, code: null }
    return { generate: ai, review: ai }
  }

  /** Fixture "Co drafts" are written here, clearly labelled synthetic, only so the review queue can be exercised in development. */
  function makeBatch(planId: string, input: { topicId: string; materialIds: string[]; count: number }): Batch {
    const id = nextId('batch')
    const topic = TOPICS[input.topicId] ?? { plan: planId, planTitle: '', title: 'Topic' }
    const ids: string[] = []
    const fixtures: QuestionContent[] = [
      { ...withOptions('MCQ', input.topicId, '[Fixture] What does the denominator tell you?', ['How many equal parts the whole has', 'How many parts you take', 'The size of the whole', 'Nothing'], [0]), explanation: 'Fixture explanation.' },
      { ...contentForType('SHORT_ANSWER', { topicId: input.topicId }), prompt: '[Fixture] Why do we need a common denominator to add fractions?', difficulty: 'MEDIUM', correctAnswer: { kind: 'text', sample: 'So the parts are the same size.' }, rubric: 'Mentions same-size parts.' },
      { ...contentForType('TRUE_FALSE', { topicId: input.topicId }), prompt: '[Fixture] 1/2 is larger than 1/3.', difficulty: 'EASY', correctAnswer: { kind: 'option', optionId: 'true' } },
      { ...contentForType('FILL_BLANK', { topicId: input.topicId }), prompt: '[Fixture] 1/4 + ___ = 1/2', difficulty: 'MEDIUM', correctAnswer: { kind: 'blanks', blanks: [] } },
    ]
    fixtures.slice(0, Math.min(input.count, fixtures.length)).forEach((c, index) => {
      const qid = nextId('q')
      make(qid, input.topicId, c, {
        status: 'DRAFT', reviewState: 'PENDING_REVIEW', origin: 'CO', version: 1, revisions: [], updatedAt: iso(),
        flags: index === 1 ? [{ id: nextId('f'), kind: 'AMBIGUOUS', source: 'CO', note: 'Fixture suggestion: "need" could mean always or only for unlike denominators.', relatedQuestionId: null }] : [],
        provenance: { origin: 'CO', packVersion: '0.1.10', promptRelease: 'fixture', traceId: `trace-${qid}`, batchId: id, importId: null, authoredBy: 'teacher-1', reviewedBy: null, reviewedAt: null, approvedBy: null },
      })
      ids.push(qid)
    })
    const batch: Batch = {
      id, planId, topicId: input.topicId, ids, polls: 0, failureCode: state === 'batch-failed' ? 'invalid_output' : null, topicTitle: topic.title,
      status: state === 'batch-failed' ? 'FAILED' : state === 'batch-running' ? 'QUEUED' : 'READY',
      materialTitles: input.materialIds.map(m => base.materials.find(x => x.id === m)?.title ?? m),
    }
    if (batch.status === 'FAILED') ids.forEach(qid => rows.delete(qid))
    batches.set(id, batch)
    return batch
  }
  const batchView = (b: Batch) => ({ id: b.id, status: b.status, requestedCount: b.ids.length, draftCount: b.status === 'READY' ? b.ids.length : 0, failureCode: b.failureCode, topicTitle: b.topicTitle, materialTitles: b.materialTitles, createdAt: iso(), finishedAt: b.status === 'READY' || b.status === 'FAILED' ? iso() : null })

  function publish(d: QuestionDetail, userId = 'teacher-1') {
    if (d.draftRevision) { d.content = d.draftRevision.content; d.draftRevision = null; d.hasDraftRevision = false }
    d.status = 'PUBLISHED'; d.version += 1
    d.revisions = [...d.revisions.filter(r => r.state === 'PUBLISHED'), { revision: d.version, state: 'PUBLISHED', publishedAt: new Date().toISOString(), publishedBy: userId }]
    d.provenance.approvedBy = userId
    touch(d)
  }

  function handle(method: string, rawPath: string, query: URLSearchParams, body: Json | undefined, headers: Record<string, string>): MockResponse {
    const path = rawPath.replace(/\/+$/, '')
    let m: RegExpMatchArray | null
    const isQuestionRoute = path.startsWith('/questions') || /^\/plans\/[^/]+\/questions/.test(path)
    if (!isQuestionRoute) return base.handle(method, rawPath, query, body, headers)
    if (state === 'denied') return fail(403, 'NOT_TEACHING_SCOPE')

    if (method === 'GET' && path === '/questions') {
      if (state === 'error') return fail(500, 'INTERNAL')
      const get = (k: string) => query.get(k) ?? ''
      const q = get('q').toLowerCase()
      const all = [...rows.values()].map(r => r.detail).filter(d => !get('planId') || d.planId === get('planId'))
      const filtered = all.filter(d => (!get('topicId') || d.topicId === get('topicId')) && (!get('type') || d.type === get('type')) && (!get('difficulty') || d.difficulty === get('difficulty'))
        && (!get('origin') || d.origin === get('origin')) && (!get('status') || d.status === get('status')) && (!get('reviewState') || d.reviewState === get('reviewState'))
        && (get('flagged') !== 'true' || d.flags.length > 0) && (!q || d.promptPreview.toLowerCase().includes(q)))
      const tally = (pick: (d: QuestionDetail) => string) => all.reduce<Record<string, number>>((acc, d) => { acc[pick(d)] = (acc[pick(d)] ?? 0) + 1; return acc }, {})
      return ok({ items: filtered.map(item), facets: { types: tally(d => d.type), origins: tally(d => d.origin), statuses: tally(d => d.status) }, nextCursor: null })
    }
    if (method === 'GET' && path === '/questions/co/state') return ok(coState())
    if (method === 'POST' && path === '/questions/co-review') return ok({ jobId: nextId('job') }, 202)
    if (method === 'POST' && (m = path.match(/^\/plans\/([^/]+)\/questions\/co-drafts$/))) {
      if (state === 'co-unavailable') return fail(503, 'CO_UNAVAILABLE')
      if (!headers['Idempotency-Key']) return fail(400, 'VALIDATION')
      return ok({ batch: batchView(makeBatch(m[1]!, body as never)) }, 202)
    }
    if (method === 'GET' && (m = path.match(/^\/plans\/([^/]+)\/questions\/co-drafts$/))) {
      const mine = [...batches.values()].filter(b => b.planId === m![1]).reverse()
      return ok({ batches: mine.map(b => { const view = batchView(b); return { id: view.id, status: view.status, requestedCount: view.requestedCount, draftCount: view.draftCount, failureCode: view.failureCode, topicTitle: view.topicTitle, createdAt: view.createdAt, finishedAt: view.finishedAt } }) })
    }
    if (method === 'GET' && (m = path.match(/^\/questions\/co-drafts\/([^/]+)$/))) {
      const batch = batches.get(m[1]!); if (!batch) return fail(404, 'NOT_FOUND')
      if (batch.status === 'QUEUED' || batch.status === 'RUNNING') { batch.polls += 1; batch.status = batch.polls >= 3 ? 'READY' : 'RUNNING' }
      return ok({ batch: batchView(batch), drafts: batch.status === 'READY' ? batch.ids.map(i => rows.get(i)!.detail) : [] })
    }
    if (method === 'POST' && (m = path.match(/^\/plans\/([^/]+)\/questions$/))) {
      const c = body as unknown as QuestionContent
      const topic = TOPICS[c.topicId]; if (!topic || topic.plan !== m[1]) return fail(422, 'QUESTION_INVALID', { details: [{ path: 'topicId', code: 'UNKNOWN_TOPIC' }] })
      if (validateQuestion(c).length > 0) return fail(422, 'QUESTION_INVALID', { details: validateQuestion(c).map(i => ({ path: i.path, code: i.code })) })
      const id = nextId('q'); const d = make(id, c.topicId, normaliseContent(c), { status: 'DRAFT', version: 1, revisions: [], provenance: { origin: 'MANUAL', packVersion: null, promptRelease: null, traceId: null, batchId: null, importId: null, authoredBy: 'teacher-1', reviewedBy: null, reviewedAt: null, approvedBy: null } })
      return ok({ question: d }, 201)
    }
    if ((m = path.match(/^\/questions\/([^/]+)(?:\/(publish|discard-draft|archive|review|flags\/([^/]+)\/dismiss))?$/))) {
      const row = rows.get(m[1]!); if (!row) return fail(404, 'NOT_FOUND')
      const d = row.detail; const action = m[2]
      if (!action && method === 'GET') return ok({ question: d })
      if (!action && method === 'DELETE') {
        if (d.status !== 'DRAFT' || d.origin === 'CO' || d.revisions.some(r => r.state === 'PUBLISHED')) return fail(409, 'USE_ARCHIVE')
        rows.delete(d.id); return { status: 204 }
      }
      if (!action && method === 'PUT') {
        const b = body as unknown as { content: QuestionContent; expectedVersion: number }
        putCount += 1
        if (state === 'conflict' && putCount === 1) { d.version += 1; return fail(409, 'VERSION_CONFLICT', { currentVersion: d.version }) }
        if (b.expectedVersion !== d.version) return fail(409, 'VERSION_CONFLICT', { currentVersion: d.version })
        const problems = validateQuestion(b.content)
        if (problems.length) return fail(422, 'QUESTION_INVALID', { details: problems.map(i => ({ path: i.path, code: i.code })) })
        if (d.status === 'PUBLISHED') { d.draftRevision = { revision: d.version + 1, content: b.content, updatedAt: new Date().toISOString() }; d.hasDraftRevision = true; d.revisions = [...d.revisions.filter(r => r.state !== 'DRAFT'), { revision: d.version + 1, state: 'DRAFT', publishedAt: null, publishedBy: null }] }
        else { d.content = b.content; d.type = b.content.type; d.difficulty = b.content.difficulty; if (d.origin === 'CO' && d.reviewState === 'PENDING_REVIEW') d.reviewState = 'EDITED' }
        touch(d); return ok({ question: d })
      }
      if (action === 'publish' && method === 'POST') {
        if ((body as { expectedVersion: number }).expectedVersion !== d.version) return fail(409, 'VERSION_CONFLICT')
        publish(d); return ok({ question: d })
      }
      if (action === 'discard-draft' && method === 'POST') { d.draftRevision = null; d.hasDraftRevision = false; d.revisions = d.revisions.filter(r => r.state === 'PUBLISHED'); touch(d); return ok({ question: d }) }
      if (action === 'archive' && method === 'POST') { d.status = 'ARCHIVED'; touch(d); return ok({ question: d }) }
      if (action === 'review' && method === 'POST') {
        const b = body as { decision: 'ACCEPT' | 'REJECT'; expectedVersion: number }
        if (b.expectedVersion !== d.version) return fail(409, 'VERSION_CONFLICT')
        if (b.decision === 'ACCEPT') { const problems = validateQuestion(d.content); if (problems.length) return fail(422, 'QUESTION_INVALID', { details: problems.map(i => ({ path: i.path, code: i.code })) }); publish(d); d.reviewState = 'ACCEPTED' }
        else { d.status = 'ARCHIVED'; d.reviewState = 'REJECTED' }
        d.provenance.reviewedBy = 'teacher-1'; d.provenance.reviewedAt = new Date().toISOString(); touch(d); return ok({ question: d })
      }
      if (action?.startsWith('flags/') && method === 'POST') { d.flags = d.flags.filter((f: QuestionFlag) => f.id !== m![3]); return ok({ dismissed: true }) }
    }
    return fail(404, 'NOT_FOUND')
  }
  seedBatch()
  return { handle, rows, batches }
}
export type MockQuestions = ReturnType<typeof createMockQuestions>
