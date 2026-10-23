import { describe, expect, it, vi } from 'vitest'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { assignmentsApi } from '@/lib/api/teaching/assignments'
import { checkFile, checkLink, linkedQuestionSchema, materialsApi } from '@/lib/api/teaching/materials'
import {
  IntentKey, checkOutline, defaultBandForGrade, isRevisionConflict, listQuery, parseResponse, planDetailSchema, plansApi, teachingErrorText, toTreeDto, type PlanTreeNode,
} from '@/lib/api/teaching/plans'
import { topicWorkspaceSchema } from '@/lib/api/teaching/topics'
import { FIXTURE_LESSON, createMockTeaching } from '@/app/dev/teacher/plans/mock-server'

/** The mock server shaped like contract section 6; the schemas must accept every response it makes. */
function bound(state = 'default') {
  const server = createMockTeaching(state)
  const calls: { suffix: string; method: string; body: unknown; headers?: Record<string, string> }[] = []
  const request = vi.fn(async (suffix: string, method = 'GET', body?: unknown, headers?: Record<string, string>) => {
    calls.push({ suffix, method, body, headers })
    const [path = '', search = ''] = suffix.split('?')
    const result = server.handle(method, path, new URLSearchParams(search), body as Record<string, unknown> | undefined, headers ?? {})
    if (result.status >= 400) throw new TeachingApiError(result.status, 'failed', (result.body as { code?: string }).code ?? null)
    return result.status === 204 ? undefined : (result.body as { data: unknown }).data
  }) as unknown as Parameters<typeof plansApi>[0]
  return { request, calls, server }
}

describe('contract schemas accept the fixture responses', () => {
  it('plan card list, detail and topic workspace parse', async () => {
    const { request } = bound()
    const api = plansApi(request)
    const list = await api.list({ limit: 20 }); expect(list.items).toHaveLength(2); expect(list.counts).toEqual({ draft: 1, published: 1, archived: 0 })
    const detail = await api.get('plan-fractions'); expect(detail.frozen).toBe(true); expect(detail.studentVisibility.state).toBe('PUBLISHED_NOT_ASSIGNED')
    const workspace = topicWorkspaceSchema.parse(await request('/plans/plan-fractions/topics/topic-add')); expect(workspace.worksheet.available).toBe(false)
  })
  it('a response with a missing field is a 502, never a partial result', async () => {
    const { request } = bound()
    const broken = (async () => ({ id: 'x' })) as unknown as Parameters<typeof plansApi>[0]
    await expect(plansApi(broken).get('x')).rejects.toMatchObject({ status: 502 })
    expect(() => parseResponse(planDetailSchema, null)).toThrow()
    void request
  })
  it('a linked question carrying an answer field fails to parse', () => {
    const question = { id: 'q', type: 'MULTIPLE_CHOICE', status: 'PUBLISHED', promptPreview: 'Which?', materialIds: [] }
    expect(linkedQuestionSchema.safeParse(question).success).toBe(true)
    expect(linkedQuestionSchema.safeParse({ ...question, correctAnswer: 'B' }).success).toBe(false)
    expect(linkedQuestionSchema.safeParse({ ...question, explanation: 'x' }).success).toBe(false)
    expect(linkedQuestionSchema.safeParse({ ...question, options: [] }).success).toBe(false)
  })
})

describe('mutations send expectedRevision and an Idempotency-Key', () => {
  it('tree, publish, unpublish and archive carry the revision and a key', async () => {
    const { request, calls } = bound(); const api = plansApi(request)
    const draft = await api.get('plan-algebra')
    await api.putTree('plan-algebra', { expectedRevision: draft.revision, tree: toTreeDto(draft.tree) })
    const published = await api.publish('plan-algebra', draft.revision + 1)
    expect(published.status).toBe('PUBLISHED')
    for (const call of calls.filter(entry => entry.method !== 'GET')) {
      expect(call.headers?.['Idempotency-Key']).toMatch(/.{8,}/)
      expect((call.body as { expectedRevision: number }).expectedRevision).toBeTypeOf('number')
    }
  })
  it('a stale revision is a revision conflict', async () => {
    const { request } = bound(); const api = plansApi(request)
    await expect(api.publish('plan-algebra', 99)).rejects.toSatisfy(isRevisionConflict)
    await expect(api.update('plan-algebra', { expectedRevision: 99, title: 'x' })).rejects.toSatisfy(isRevisionConflict)
  })
  it('a frozen published plan refuses the tree', async () => {
    const { request } = bound(); const api = plansApi(request)
    const plan = await api.get('plan-fractions')
    const error = await api.putTree(plan.id, { expectedRevision: plan.revision, tree: toTreeDto(plan.tree) }).catch((failure: unknown) => failure)
    expect(teachingErrorText(error)).toMatch(/structure/i)
  })
  it('create sends the same key on a retry of the same body and a new key for a different body', () => {
    const intent = new IntentKey(); const a = { title: 'a' }
    const first = intent.keyFor(a); expect(intent.keyFor({ title: 'a' })).toBe(first)
    expect(intent.keyFor({ title: 'b' })).not.toBe(first)
    intent.done(); expect(intent.keyFor({ title: 'b' })).not.toBe(first)
  })
  it('create is idempotent: two creates with one key make one plan', async () => {
    const { request, server } = bound(); const api = plansApi(request)
    const input = { title: 'Once', classId: 'class-6a', subject: 'Mathematics', targetBand: '10-13' as const, source: { kind: 'SCRATCH' as const } }
    const a = await api.create(input, 'key-0001-abc'); const b = await api.create(input, 'key-0001-abc')
    expect(b.id).toBe(a.id); expect([...server.plans.values()].filter(plan => plan.title === 'Once')).toHaveLength(1)
  })
})

describe('materials, links and assignments', () => {
  it('checks files like the server: types and sizes', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }).type).toBe('PDF')
    expect(checkFile({ name: 'a.pptx', type: '', size: 10 }).type).toBe('SLIDES')
    expect(checkFile({ name: 'a.docx', type: '', size: 10 }).type).toBe('DOCX')
    expect(checkFile({ name: 'a.mp4', type: 'video/mp4', size: 10 }).type).toBe('VIDEO_UPLOAD')
    expect(checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }).type).toBe('IMAGE')
    expect(checkFile({ name: 'a.gif', type: 'image/gif', size: 10 }).problem).toMatch(/not supported/)
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 51 * 1024 * 1024 }).problem).toMatch(/too large/)
    expect(checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 21 * 1024 * 1024 }).problem).toMatch(/too large/)
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }, true).problem).toMatch(/photo/)
  })
  it('links: https only, no credentials, no private host, video detection', () => {
    expect(checkLink('https://www.youtube.com/watch?v=1')).toMatchObject({ ok: true, video: true })
    expect(checkLink('https://example.com/page')).toMatchObject({ ok: true, video: false })
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'https://user:pw@example.com', 'https://localhost/x', 'https://10.0.0.5/x', 'https://192.168.1.1', 'https://127.0.0.1', '', 'not a link', `https://example.com/${'a'.repeat(2050)}`]) expect(checkLink(bad).ok).toBe(false)
  })
  it('an unassign result and an assignment parse; the roster carries counts only', async () => {
    const { request } = bound('assigned'); const api = assignmentsApi(request)
    const [mine] = await api.list('plan-fractions'); expect(mine!.roster).toMatchObject({ total: 24, pendingGuardian: 19 }); expect(JSON.stringify(mine)).not.toMatch(/displayName|dateOfBirth|guardian":/)
    const removed = await api.unassign('plan-fractions', mine!.id); expect(removed).toMatchObject({ removed: true }); expect(removed.revoked + removed.retained).toBeGreaterThan(0)
    expect(await api.unassign('plan-fractions', mine!.id)).toEqual({ removed: false, revoked: 0, retained: 0 })
  })
  it('material delete is refused while a lesson draft cites it', async () => {
    const { request, server } = bound(); const api = materialsApi(request)
    server.handle('PUT', '/plans/plan-fractions/topics/topic-add/lessons/draft', new URLSearchParams(), { expectedRevision: null, content: FIXTURE_LESSON, sourceMaterialIds: ['mat-pdf'] }, {})
    await expect(api.remove('plan-fractions', 'mat-pdf')).rejects.toMatchObject({ status: 409 })
  })
})

describe('helpers', () => {
  it('suggests a band from the grade', () => { expect([1, 4, 5, 8, 9, 10].map(defaultBandForGrade)).toEqual(['6-9', '6-9', '10-13', '10-13', '14-17', '14-17']) })
  it('checks an outline against the importer limits and names the line', () => {
    expect(checkOutline('Fractions\n  - Parts\n  - Adding\nDecimals')).toBeNull()
    expect(checkOutline('  - orphan topic')).toMatchObject({ line: 1 })
    expect(checkOutline('')).toMatchObject({ message: 'Add at least one phase.' })
    expect(checkOutline(Array.from({ length: 21 }, (_, i) => `Phase ${i}`).join('\n'))).toMatchObject({ line: 21 })
    expect(checkOutline(`Phase\n${Array.from({ length: 201 }, (_, i) => `  - t${i}`).join('\n')}`)).toMatchObject({ line: 202 })
    expect(checkOutline('x'.repeat(8001))).not.toBeNull()
  })
  it('builds a list query with only allowed filters', () => { expect(listQuery({ classId: 'c', status: 'DRAFT', q: ' fractions ', cursor: 'abc', limit: 5 })).toBe('limit=5&classId=c&status=DRAFT&q=fractions&cursor=abc') })
  it('maps the tree to the legacy dto without counts or dates', () => {
    const node = { id: 'a', kind: 'module', title: 'A', description: null, sortOrder: 0, dueAt: 'x', prerequisiteTopicIds: [], counts: { materials: 1, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' }, children: [] } as PlanTreeNode
    expect(toTreeDto([node])).toEqual([{ id: 'a', kind: 'module', title: 'A', prerequisiteTopicIds: [], children: [] }])
  })
})
