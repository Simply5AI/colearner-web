import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { accessToken: 'token', user: { id: 'admin-a' } } }), getSession: vi.fn() }))
// Classes and memberships still go through the shared school client; curriculum calls go through `curriculumRequest`.
vi.mock('@/lib/api/school-browser', () => ({ schoolBrowserRequest: mocks.request }))
vi.mock('@/lib/api/curriculum', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/curriculum')>(), curriculumRequest: mocks.request }))
import { ApiError } from '@/lib/api/client'
import { CurriculumApiError, curriculumCodeMessages } from '@/lib/api/curriculum'
import { CurriculumScreen } from '@/components/school/curriculum-screen'

const base = '/schools/school-a'
const notice = 'Coverage shows only reviewed structure loaded from the cited source. A board name or a loaded subject is not a claim of a complete syllabus.'
const planId = '3f2b8c1e-5a4d-4e7b-9c10-2d6f8a1b3c4e'
const topicId = '7a1c9d20-0b3e-4f55-8a6d-1c2e3f405162'
const row = (over: Record<string, unknown> = {}) => ({ board: 'CBSE', grade: 3, subjectKey: 'science', subjectName: 'Science', chapterCount: 12, topicCount: 40, versionLabel: 'SYNTHETIC v1', sourceTitle: 'Synthetic test source', reviewerName: 'Test Reviewer', reviewedAt: '2026-10-01T00:00:00.000Z', status: 'COVERED', ...over })
const notLoaded = (over: Record<string, unknown> = {}) => row({ subjectKey: null, subjectName: null, chapterCount: 0, topicCount: 0, versionLabel: null, sourceTitle: null, reviewerName: null, reviewedAt: null, status: 'NOT_LOADED', ...over })
const version = { id: 'v-1', label: 'SYNTHETIC v1', sourceTitle: 'Synthetic test source', sourceUrl: null, reviewerName: 'Test Reviewer', reviewedAt: '2026-10-01T00:00:00.000Z', publishedAt: '2026-10-02T00:00:00.000Z' }
const subject = { id: 'cs-1', board: 'CBSE', grade: 3, key: 'science', name: 'Science', subjectId: null, chapterCount: 1, topicCount: 1, version, chapters: [{ id: 'ch-1', ordinal: 1, title: 'Plants', topics: [{ id: topicId, ordinal: 1, title: 'Parts of a plant' }] }] }
const available = { curriculumSubjectId: 'cs-1', key: 'science', name: 'Science', subjectId: null, chapterCount: 1, topicCount: 1, versionLabel: 'SYNTHETIC v1', sourceTitle: 'Synthetic test source' }
const schoolClass = { id: 'class-a', schoolId: 'school-a', board: 'CBSE', grade: 3, section: 'A', archivedAt: null }
const classView = (over: Record<string, unknown> = {}) => ({ class: { id: 'class-a', schoolId: 'school-a', board: 'CBSE', grade: 3, section: 'A', archived: false }, items: [], available: [available], notice, ...over })
const assignment = (over: Record<string, unknown> = {}) => ({ id: 'a-1', classId: 'class-a', kind: 'PLAN', refId: planId, title: 'Term 1 plan', available: true, dueAt: null, createdBy: 'admin-a', createdAt: '2026-10-19T00:00:00.000Z', ...over })
const page = (items: unknown[], total = items.length) => ({ items, total, page: 1, pageSize: 100 })
const teacher = { id: 'm-1', userId: 'user-teacher', name: 'Asha Rao', email: 'asha@example.invalid', role: 'TEACHER', status: 'ACTIVE' }

interface World { coverage: unknown; catalog: unknown; mapped: unknown; assignments: unknown; classes: unknown; fail: Record<string, ApiError> }
let world: World
const calls = () => mocks.request.mock.calls.map(([path, method, body]) => ({ path: path as string, method: (method ?? 'GET') as string, body }))
beforeEach(() => {
  configure({ asyncUtilTimeout: 10000 }); vi.setConfig({ testTimeout: 20000 }); vi.clearAllMocks()
  world = {
    coverage: { rows: [row(), row({ subjectKey: 'maths', subjectName: 'Maths', status: 'PARTIAL', topicCount: 9 }), notLoaded({ board: 'ICSE', grade: 1 })], notice },
    catalog: { subjects: [subject], notice }, mapped: classView(), assignments: page([]), classes: { items: [schoolClass], total: 1, page: 1, pageSize: 100 }, fail: {},
  }
  mocks.request.mockImplementation(async (path: string, method = 'GET') => {
    const key = `${method} ${path}`
    for (const [pattern, error] of Object.entries(world.fail)) if (key.includes(pattern)) throw error
    if (method === 'GET') {
      if (path === `${base}/curriculum/coverage`) return world.coverage
      if (path.startsWith(`${base}/curriculum/catalog`)) return world.catalog
      if (path.endsWith('/subjects')) return world.mapped
      if (path.includes('/assignments')) return world.assignments
      if (path.startsWith(`${base}/classes`)) return world.classes
      if (path.startsWith(`${base}/memberships`)) return { items: [teacher], nextCursor: null }
    }
    return {}
  })
})
afterEach(() => { cleanup(); configure({ asyncUtilTimeout: 1000 }) })
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><CurriculumScreen schoolId="school-a" /></QueryClientProvider>)
}
const chooseClass = async () => { fireEvent.change(await screen.findByLabelText('Class to manage'), { target: { value: 'class-a' } }) }
const refused = (status: number, code: string) => new CurriculumApiError(status, curriculumCodeMessages[code]!, code)

describe('S5 coverage report (F-S5-01/02/04)', () => {
  it('shows counts, version, source, reviewer, the platform notice and an honest status per row', async () => {
    show()
    const table = await screen.findByRole('table', { name: 'Curriculum coverage by board, class and subject' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(within(rows[1]!).getByText('Covered')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Test Reviewer')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('SYNTHETIC v1')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('Partial')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('Not loaded')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 covered · 1 partial · 1 not loaded')
    expect(screen.getByText(/A board name alone never means a class has full curriculum content/)).toBeInTheDocument()
    expect(screen.getAllByText(notice).length).toBeGreaterThan(0)
  })
  it('renders the platform NOT_LOADED row, which has no subject, without failing or inventing one', async () => {
    show()
    const table = await screen.findByRole('table', { name: 'Curriculum coverage by board, class and subject' })
    const empty = within(table).getAllByRole('row')[3]!
    expect(within(empty).getByText('No subject loaded')).toBeInTheDocument()
    expect(within(empty).getByText('ICSE')).toBeInTheDocument()
    expect(within(empty).queryByText('0')).not.toBeInTheDocument()
  })
  it('never implies coverage when the platform reports every board and class as NOT_LOADED', async () => {
    world.coverage = { rows: [notLoaded({ board: 'CBSE', grade: 1 }), notLoaded({ board: 'CBSE', grade: 2 }), notLoaded({ board: 'ICSE', grade: 1 })], notice }
    show()
    expect(await screen.findByText('No curriculum is loaded yet')).toBeInTheDocument()
    expect(screen.getByText(/No chapters or topics are shown or assumed/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Covered')).not.toBeInTheDocument()
  })
  it('treats an empty row list the same way', async () => {
    world.coverage = { rows: [], notice }
    show()
    expect(await screen.findByText('No curriculum is loaded yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('filters rows without another request', async () => {
    show()
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Filter by board'), { target: { value: 'ICSE' } })
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)
  })
  it('explains denied access and offers retry on an unavailable service', async () => {
    world.fail = { 'curriculum/coverage': new ApiError(403, 'You do not have permission for this school or action.') }
    show()
    expect(await screen.findAllByText('School access denied')).not.toHaveLength(0)
    world.fail = { 'curriculum/coverage': new ApiError(503, 'School services are unavailable. Please try again.') }
    cleanup(); show()
    const retry = await screen.findAllByRole('button', { name: 'Try again' })
    world.fail = {}
    fireEvent.click(retry[0]!)
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
  it('denies a 403 from the curriculum client exactly like the other school screens', async () => {
    world.fail = { 'curriculum/coverage': new CurriculumApiError(403, 'You do not have permission for this school or action.') }
    show()
    expect(await screen.findAllByText('School access denied')).not.toHaveLength(0)
  })
  it('rejects an unreadable service response instead of rendering guesses', async () => {
    world.coverage = { rows: [{ board: 'IB', grade: 3 }], notice }
    show()
    expect(await screen.findAllByText('School records unavailable')).not.toHaveLength(0)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('rejects the bare array the contract used to allow', async () => {
    world.coverage = [row()]
    show()
    expect(await screen.findAllByText('School records unavailable')).not.toHaveLength(0)
  })
})

describe('S5 catalog browser (F-S5-01)', () => {
  it('lists subject, chapter and topic with provenance from the { subjects, notice } response, and reports not-loaded selections honestly', async () => {
    show()
    const summary = await screen.findByText(/Science/, { selector: 'summary' })
    expect(summary).toHaveTextContent('1 chapters · 1 topics · SYNTHETIC v1')
    expect(screen.getByText('Parts of a plant')).toBeInTheDocument()
    expect(screen.getByText('Source: Synthetic test source · Reviewed by Test Reviewer')).toBeInTheDocument()
    world.catalog = { subjects: [], notice: 'No reviewed curriculum has been loaded for this selection.' }
    fireEvent.change(screen.getByLabelText('Catalog board'), { target: { value: 'ICSE' } })
    expect(await screen.findByText('ICSE Class 1: not loaded')).toBeInTheDocument()
    expect(calls().some(call => call.path === `${base}/curriculum/catalog?board=ICSE&grade=1`)).toBe(true)
  })
  it('uses the server counts and copes with a subject whose chapter tree is absent', async () => {
    world.catalog = { subjects: [{ ...subject, chapterCount: 12, topicCount: 40, chapters: null }], notice }
    show()
    const summary = await screen.findByText(/Science/, { selector: 'summary' })
    expect(summary).toHaveTextContent('12 chapters · 40 topics')
    expect(screen.getByText('This subject is listed with no chapters loaded.')).toBeInTheDocument()
  })
})

describe('S5 class subject mapping and assignments (F-S5-03)', () => {
  it('maps from the class-specific available subjects and does not need the catalog for them', async () => {
    show()
    await chooseClass()
    await screen.findByRole('checkbox', { name: /Science/ })
    expect(calls().some(call => call.path === `${base}/classes/class-a/subjects` && call.method === 'GET')).toBe(true)
    expect(screen.getAllByText(notice).length).toBeGreaterThan(0)
  })
  it('shows the mapped subject, teacher and an unavailable mapped subject by name', async () => {
    world.mapped = classView({
      items: [{ id: 'row-1', curriculumSubjectId: 'cs-1', key: 'science', name: 'Science', subjectId: null, teacherUserId: 'user-teacher', teacherName: 'Asha Rao', chapterCount: 1, topicCount: 1, versionLabel: 'SYNTHETIC v1', versionStatus: 'PUBLISHED' },
        { id: 'row-2', curriculumSubjectId: 'cs-old', key: 'art', name: 'Art', subjectId: null, teacherUserId: null, teacherName: null, chapterCount: 0, topicCount: 0, versionLabel: 'OLD', versionStatus: 'REVIEWED' }],
    })
    show()
    await chooseClass()
    expect(await screen.findByRole('checkbox', { name: /Science/ })).toBeChecked()
    expect(await screen.findByLabelText('Teacher for Science (optional)')).toHaveValue('user-teacher')
    expect(screen.getByRole('checkbox', { name: /Art/ })).toBeChecked()
    expect(screen.getByText(/no longer in the catalog for this class/)).toBeInTheDocument()
  })
  it('keeps edits and retries the same PUT when saving fails, then saves once', async () => {
    show()
    await chooseClass()
    const box = await screen.findByRole('checkbox', { name: /Science/ })
    fireEvent.click(box)
    fireEvent.change(await screen.findByLabelText('Teacher for Science (optional)'), { target: { value: 'user-teacher' } })
    world.fail = { 'PUT': new ApiError(503, 'School services are unavailable. Please try again.') }
    fireEvent.click(screen.getByRole('button', { name: 'Save subject mapping' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('School services are unavailable')
    expect(screen.getByRole('checkbox', { name: /Science/ })).toBeChecked()
    expect(screen.getByLabelText('Teacher for Science (optional)')).toHaveValue('user-teacher')
    world.fail = {}
    fireEvent.click(screen.getByRole('button', { name: 'Save subject mapping' }))
    await waitFor(() => expect(calls().filter(call => call.method === 'PUT')).toHaveLength(2))
    const puts = calls().filter(call => call.method === 'PUT')
    expect(puts[0]!.path).toBe(`${base}/classes/class-a/subjects`)
    expect(puts[1]!.body).toEqual(puts[0]!.body)
    expect(puts[0]!.body).toEqual({ subjects: [{ curriculumSubjectId: 'cs-1', teacherUserId: 'user-teacher' }] })
  })
  it('says nothing can be mapped when no curriculum is loaded for the class', async () => {
    world.mapped = classView({ available: [], notice: 'No reviewed curriculum has been loaded for this selection.' })
    show()
    await chooseClass()
    expect(await screen.findByText('No curriculum subjects to map')).toBeInTheDocument()
    expect(screen.getByText(/CBSE Class 3 subjects \(not loaded\)/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save subject mapping' })).not.toBeInTheDocument()
  })
  it('surfaces why the platform refused a mapping, in our words, and keeps the draft', async () => {
    show()
    await chooseClass()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Science/ }))
    world.fail = { 'PUT': refused(400, 'CURRICULUM_SUBJECT_MISMATCH') }
    fireEvent.click(screen.getByRole('button', { name: 'Save subject mapping' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('belongs to a different board or class')
    expect(screen.getByRole('checkbox', { name: /Science/ })).toBeChecked()
  })
  it('explains a forbidden mapping save without losing the draft', async () => {
    show()
    await chooseClass()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Science/ }))
    world.fail = { 'PUT': new ApiError(403, 'You do not have permission for this school or action.') }
    fireEvent.click(screen.getByRole('button', { name: 'Save subject mapping' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission')
    expect(screen.getByRole('checkbox', { name: /Science/ })).toBeChecked()
  })
  it('assigns a plan by UUID with a due date, retries after a failure and clears only after success', async () => {
    show()
    await chooseClass()
    await screen.findByText('Nothing has been assigned to this class yet.')
    expect(calls().some(call => call.path === `${base}/classes/class-a/assignments?page=1&pageSize=100`)).toBe(true)
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: 'plan-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    expect(await screen.findByText(/Enter the plan or material ID/)).toBeInTheDocument()
    expect(calls().some(call => call.method === 'POST')).toBe(false)
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: planId } })
    fireEvent.change(screen.getByLabelText('Due date (optional)'), { target: { value: '2999-01-31' } })
    world.fail = { 'POST': new ApiError(503, 'School services are unavailable. Please try again.') }
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Plan ID')).toHaveValue(planId)
    world.fail = {}
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    await waitFor(() => expect(screen.getByLabelText('Plan ID')).toHaveValue(''))
    const posts = calls().filter(call => call.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0]!.path).toBe(`${base}/classes/class-a/assignments`)
    expect(posts[1]!.body).toEqual({ kind: 'PLAN', refId: planId, dueAt: expect.stringMatching(/^2999-01-3[01]T/) })
  })
  it('shows the platform reason when a plan or material is not assignable (ids are validated server-side)', async () => {
    show()
    await chooseClass()
    await screen.findByText('Nothing has been assigned to this class yet.')
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: planId } })
    world.fail = { 'POST': refused(400, 'ASSIGNMENT_REFERENCE_UNAVAILABLE') }
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be assigned. It must be published, belong to your school')
    expect(screen.getByLabelText('Plan ID')).toHaveValue(planId)
  })
  it('shows a past due date refusal from the platform', async () => {
    show()
    await chooseClass()
    await screen.findByText('Nothing has been assigned to this class yet.')
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: planId } })
    fireEvent.change(screen.getByLabelText('Due date (optional)'), { target: { value: '2001-01-31' } })
    world.fail = { 'POST': refused(400, 'DUE_DATE_IN_PAST') }
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('due date must be in the future')
  })
  it('does not re-send an identical assignment, but lets a new due date through (the platform only moves the date)', async () => {
    world.assignments = page([assignment()])
    show()
    await chooseClass()
    await screen.findByText('Term 1 plan')
    fireEvent.change(screen.getByLabelText('Plan ID'), { target: { value: planId } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    expect(await screen.findByText(/already assigned/)).toBeInTheDocument()
    expect(calls().some(call => call.method === 'POST')).toBe(false)
    fireEvent.change(screen.getByLabelText('Due date (optional)'), { target: { value: '2999-02-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    await waitFor(() => expect(calls().find(call => call.method === 'POST')?.body).toEqual({ kind: 'PLAN', refId: planId, dueAt: expect.stringMatching(/^2999-02-0[12]T/) }))
  })
  it('labels content the platform could no longer resolve and says how many assignments exist', async () => {
    world.assignments = page([assignment({ id: 'a-2', kind: 'MATERIAL', refId: topicId, title: null, available: false })], 130)
    show()
    await chooseClass()
    expect(await screen.findByText('Content no longer available')).toBeInTheDocument()
    expect(screen.getByText(/unpublished or removed/)).toBeInTheDocument()
    expect(screen.getByText('Showing the 1 most recent of 130 assignments.')).toBeInTheDocument()
  })
  it('assigns a central topic chosen from the catalog and removes an assignment only after confirmation', async () => {
    world.assignments = page([assignment({ id: 'a-1', kind: 'MATERIAL', refId: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a', title: null, available: false })])
    show()
    await chooseClass()
    fireEvent.change(await screen.findByLabelText('What to assign'), { target: { value: 'CENTRAL_TOPIC' } })
    fireEvent.change(await screen.findByLabelText('Central topic'), { target: { value: topicId } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign to class' }))
    await waitFor(() => expect(calls().find(call => call.method === 'POST')?.body).toEqual({ kind: 'CENTRAL_TOPIC', refId: topicId }))
    fireEvent.click(await screen.findByRole('button', { name: /^Remove / }))
    expect(calls().some(call => call.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(calls().find(call => call.method === 'DELETE')?.path).toBe(`${base}/classes/class-a/assignments/a-1`))
  })
})
