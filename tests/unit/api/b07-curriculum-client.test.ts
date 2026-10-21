import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), fetch: vi.fn() }))
vi.mock('next-auth/react', () => ({ getSession: mocks.getSession }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import {
  CurriculumApiError, catalogSchema, classAssignmentInputSchema, classAssignmentsSchema, classSubjectsSchema, coverageSchema, curriculumPaths, curriculumRequest,
} from '@/lib/api/curriculum'

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fail = (promise: Promise<unknown>) => promise.then(() => { throw new Error('expected a rejection') }, (error: unknown) => error as CurriculumApiError)
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch)
  mocks.getSession.mockResolvedValue({ accessToken: 'account-token', user: { id: 'admin-a' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('S5 transport', () => {
  it('sends the account token to the /api/v1 school path and unwraps the {statusCode,data,timestamp} envelope', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 200, data: { rows: [], notice: 'n' }, timestamp: '2026-10-19T00:00:00.000Z' }))
    expect(await curriculumRequest('/schools/s-1/curriculum/coverage')).toEqual({ rows: [], notice: 'n' })
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('https://platform.test/api/v1/schools/s-1/curriculum/coverage')
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', headers: { Authorization: 'Bearer account-token' } })
    expect(init.headers).not.toHaveProperty('X-School-Membership-Id')
  })
  it('accepts the platform 201 for an assignment and sends the JSON body', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 201, data: { id: 'a' }, timestamp: 'x' }, 201))
    expect(await curriculumRequest('/schools/s-1/classes/c-1/assignments', 'POST', { kind: 'PLAN', refId: 'r' })).toEqual({ id: 'a' })
    expect(mocks.fetch.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: JSON.stringify({ kind: 'PLAN', refId: 'r' }) })
  })
  it('does not call the platform without a session', async () => {
    mocks.getSession.mockResolvedValue(null)
    const error = await fail(curriculumRequest('/schools/s-1/curriculum/coverage'))
    expect(error.status).toBe(401); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('keeps the platform error code and shows our copy, never the server wording', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 400, code: 'ASSIGNMENT_REFERENCE_UNAVAILABLE', message: 'Choose published content that belongs to this school', error: 'BadRequestException', path: '/x' }, 400))
    const error = await fail(curriculumRequest('/schools/s-1/classes/c-1/assignments', 'POST', {}))
    expect(error).toBeInstanceOf(CurriculumApiError)
    expect(error.status).toBe(400); expect(error.code).toBe('ASSIGNMENT_REFERENCE_UNAVAILABLE')
    expect(error.message).toContain('cannot be assigned'); expect(error.message).not.toContain('Choose published content')
  })
  it.each([
    ['DUE_DATE_IN_PAST', 'in the future'], ['CURRICULUM_SUBJECT_UNAVAILABLE', 'published curriculum subject'], ['CURRICULUM_SUBJECT_MISMATCH', 'different board or class'],
    ['TEACHER_UNAVAILABLE', 'active teacher'], ['DUPLICATE_SUBJECT', 'only once'],
  ])('maps %s', async (code, text) => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 400, code, message: 'server wording' }, 400))
    const error = await fail(curriculumRequest('/schools/s-1/classes/c-1/subjects', 'PUT', {}))
    expect(error.code).toBe(code); expect(error.message).toContain(text); expect(error.message).not.toContain('server wording')
  })
  it('maps plain statuses, a class-validator message array and an unreadable body to safe messages', async () => {
    mocks.fetch.mockResolvedValue(reply({ statusCode: 400, message: ['refId must be a UUID'], error: 'Bad Request' }, 400))
    const invalid = await fail(curriculumRequest('/p', 'POST', {}))
    expect(invalid.status).toBe(400); expect(invalid.code).toBeUndefined(); expect(invalid.message).toBe('Check the supplied details and try again.')
    for (const [status, text] of [[403, 'permission'], [404, 'not available in your school'], [409, 'conflicts'], [429, 'Too many']] as const) {
      mocks.fetch.mockResolvedValue(reply({ statusCode: status, message: 'internal detail' }, status))
      const error = await fail(curriculumRequest('/p'))
      expect(error.status).toBe(status); expect(error.message).toContain(text); expect(error.message).not.toContain('internal')
    }
    mocks.fetch.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }))
    expect((await fail(curriculumRequest('/p'))).message).toContain('unavailable')
    mocks.fetch.mockRejectedValue(new TypeError('network'))
    expect((await fail(curriculumRequest('/p'))).status).toBe(503)
  })
})

describe('S5 response shapes are the platform DTOs', () => {
  const version = { id: 'v', label: 'L', sourceTitle: 'S', sourceUrl: null, reviewerName: null, reviewedAt: null, publishedAt: '2026-10-02T00:00:00.000Z' }
  it('reads { rows, notice } for coverage including the subject-less NOT_LOADED row', () => {
    const row = { board: 'ICSE', grade: 4, subjectKey: null, subjectName: null, chapterCount: 0, topicCount: 0, versionLabel: null, sourceTitle: null, reviewerName: null, reviewedAt: null, status: 'NOT_LOADED' }
    expect(coverageSchema.safeParse({ rows: [row], notice: 'n' }).success).toBe(true)
    expect(coverageSchema.safeParse([row]).success).toBe(false)
    expect(coverageSchema.safeParse({ rows: [{ ...row, board: 'IB' }], notice: 'n' }).success).toBe(false)
  })
  it('reads { subjects, notice } for the catalog with version provenance and a nullable tree', () => {
    const subject = { id: 's', board: 'CBSE', grade: 3, key: 'k', name: 'N', subjectId: null, chapterCount: 1, topicCount: 2, version }
    expect(catalogSchema.safeParse({ subjects: [{ ...subject, chapters: null }], notice: 'n' }).success).toBe(true)
    expect(catalogSchema.safeParse({ subjects: [{ ...subject, chapters: [{ id: 'c', ordinal: 1, title: 'T', topics: [{ id: 't', ordinal: 1, title: 'X' }] }] }], notice: 'n' }).success).toBe(true)
    expect(catalogSchema.safeParse([subject]).success).toBe(false)
  })
  it('reads { class, items, available, notice } for a class mapping', () => {
    const view = {
      class: { id: 'c', schoolId: 's', board: 'CBSE', grade: 3, section: 'A', archived: false },
      items: [{ id: 'r', curriculumSubjectId: 'cs', key: 'k', name: 'N', subjectId: null, teacherUserId: null, teacherName: null, chapterCount: 0, topicCount: 0, versionLabel: 'L', versionStatus: 'PUBLISHED' }],
      available: [{ curriculumSubjectId: 'cs', key: 'k', name: 'N', subjectId: null, chapterCount: 0, topicCount: 0, versionLabel: 'L', sourceTitle: 'S' }],
      notice: 'n',
    }
    expect(classSubjectsSchema.safeParse(view).success).toBe(true)
    expect(classSubjectsSchema.safeParse(view.items).success).toBe(false)
  })
  it('reads the paged assignment list and requires a UUID, a kind and an ISO due date when sending', () => {
    const item = { id: 'a', classId: 'c', kind: 'CENTRAL_TOPIC', refId: 'r', title: null, available: false, dueAt: null, createdBy: 'u', createdAt: '2026-10-19T00:00:00.000Z' }
    expect(classAssignmentsSchema.safeParse({ items: [item], total: 1, page: 1, pageSize: 100 }).success).toBe(true)
    expect(classAssignmentsSchema.safeParse([item]).success).toBe(false)
    const refId = '3f2b8c1e-5a4d-4e7b-9c10-2d6f8a1b3c4e'
    expect(classAssignmentInputSchema.safeParse({ kind: 'PLAN', refId, dueAt: '2999-01-31T18:29:00.000Z' }).success).toBe(true)
    for (const body of [{ kind: 'PLAN', refId: 'plan-1' }, { kind: 'LESSON', refId }, { kind: 'PLAN', refId, dueAt: '2999-01-31' }, { kind: 'PLAN', refId, extra: 1 }]) expect(classAssignmentInputSchema.safeParse(body).success).toBe(false)
  })
  it('builds the platform paths', () => {
    expect(curriculumPaths.catalog('CBSE', 3)).toBe('/curriculum/catalog?board=CBSE&grade=3')
    expect(curriculumPaths.assignmentList('c 1')).toBe('/classes/c%201/assignments?page=1&pageSize=100')
    expect(curriculumPaths.assignment('c', 'a')).toBe('/classes/c/assignments/a')
  })
})
