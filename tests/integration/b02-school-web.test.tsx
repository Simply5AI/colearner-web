import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  select: vi.fn(),
  fetch: vi.fn(),
  search: '',
}))
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { accessToken: 'session-a', user: { id: 'user-a' } },
  }),
  signOut: vi.fn(),
  getSession: async () => ({
    accessToken: 'fresh-session-a',
    user: { id: 'user-a' },
  }),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock('@/app/workspaces/actions', () => ({
  selectSchoolWorkspace: mocks.select,
}))
vi.mock('@/lib/api/platform-client', () => ({
  platformApiBaseUrl: () => 'https://platform.test/api/v1',
}))
import { AcademicsScreen } from '@/components/school/academics-screen'
import { StudentsScreen } from '@/components/school/students-screen'
import { StaffScreen } from '@/components/school/staff-screen'
import { ClassroomScreen } from '@/components/school/classroom-screen'
import { WorkspaceEntry } from '@/components/school/workspace-entry'
import { InvitationEntry } from '@/components/school/invitation-entry'
const year = {
  id: 'year-a',
  name: '2026–27',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  archivedAt: null,
}
const classroom = {
  id: 'class-a',
  academicYearId: year.id,
  board: 'CBSE',
  grade: 3,
  section: 'A',
  archivedAt: null,
}
const paged = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 100,
})
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), { status })
function baseFetch(url: string, request?: RequestInit) {
  if (request?.method !== 'GET')
    return Promise.resolve(reply({ id: 'saved', count: 1 }))
  if (url.includes('/academic-years') && !url.includes('/terms'))
    return Promise.resolve(reply(paged([year])))
  if (url.includes('/classes?'))
    return Promise.resolve(
      reply(paged([classroom, { ...classroom, id: 'class-b', grade: 4 }])),
    )
  if (url.includes('/memberships'))
    return Promise.resolve(
      reply({
        items: [
          {
            id: 'teacher-a',
            name: 'Teacher A',
            email: 'teacher@example.test',
            role: 'TEACHER',
            status: 'ACTIVE',
          },
        ],
        nextCursor: null,
      }),
    )
  if (url.includes('/invitations'))
    return Promise.resolve(reply({ items: [], nextCursor: null }))
  return Promise.resolve(reply(paged([])))
}
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  )
}
describe('B02 real forms and API interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.search = ''
    mocks.fetch.mockImplementation(baseFetch)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
  it('retains a page-two class when following academic roster and assignment links', async () => {
    const laterClass = {
      ...classroom,
      id: 'class-later',
      board: 'ICSE',
      grade: 7,
      section: 'C',
    }
    mocks.fetch.mockImplementation((url: string, request: RequestInit) => {
      if (url.includes('/classes?')) {
        const page = Number(new URL(url).searchParams.get('page') ?? 1)
        return Promise.resolve(
          reply({
            ...paged([page === 2 ? laterClass : classroom]),
            total: 101,
            page,
          }),
        )
      }
      return baseFetch(url, request)
    })
    const academicView = mount(<AcademicsScreen schoolId="school-a" />)
    await screen.findByRole('link', { name: 'Class roster' })
    const next = screen
      .getAllByRole('button', { name: 'Next page' })
      .find((button) => !button.hasAttribute('disabled'))!
    fireEvent.click(next)
    await screen.findByRole('heading', { name: 'ICSE · Class 7 C' })
    const rosterHref = screen
      .getByRole('link', { name: 'Class roster' })
      .getAttribute('href')!
    const staffHref = screen
      .getByRole('link', { name: 'Teaching assignments' })
      .getAttribute('href')!
    academicView.unmount()

    mocks.search = new URL(rosterHref, 'https://colearner.test').search
    const rosterView = mount(<StudentsScreen schoolId="school-a" />)
    await screen.findByRole('option', { name: 'ICSE · Class 7 C' })
    expect(screen.getByLabelText('Roster class')).toHaveValue('class-later')
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://platform.test/api/v1/schools/school-a/classes/class-later/roster?page=1&pageSize=100',
      expect.anything(),
    )
    rosterView.unmount()

    mocks.search = new URL(staffHref, 'https://colearner.test').search
    mount(<StaffScreen schoolId="school-a" />)
    await screen.findByRole('option', { name: 'ICSE · Class 7 C' })
    expect(screen.getByLabelText('Assigned class')).toHaveValue('class-later')
    expect(
      mocks.fetch.mock.calls.filter(([url]) =>
        String(url).endsWith('/classes?page=2&pageSize=100'),
      ),
    ).toHaveLength(3)
  })
  it('creates year with entered dates and refreshes real school query', async () => {
    mount(<AcademicsScreen schoolId="school-a" />)
    await screen.findByRole('option', { name: '2026–27' })
    fireEvent.change(screen.getByLabelText('New academic year name'), {
      target: { value: '2027–28' },
    })
    fireEvent.change(screen.getByLabelText('Academic year start'), {
      target: { value: '2027-04-01' },
    })
    fireEvent.change(screen.getByLabelText('Academic year end'), {
      target: { value: '2028-03-31' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Create academic year' }),
    )
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://platform.test/api/v1/schools/school-a/academic-years',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"2027–28","startDate":"2027-04-01","endDate":"2028-03-31"}',
        }),
      ),
    )
  })
  it('preserves academic drafts when server denies creation', async () => {
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      request?.method === 'POST'
        ? Promise.resolve(reply({}, 403))
        : baseFetch(url, request),
    )
    mount(<AcademicsScreen schoolId="school-a" />)
    fireEvent.change(screen.getByLabelText('New academic year name'), {
      target: { value: 'Retained draft' },
    })
    fireEvent.submit(
      screen.getByLabelText('New academic year name').closest('form')!,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('permission')
    expect(screen.getByLabelText('New academic year name')).toHaveValue(
      'Retained draft',
    )
  })
  it('grade selector contains only Classes1–10 and no ISC', async () => {
    mount(<AcademicsScreen schoolId="school-a" />)
    expect(
      screen.getByLabelText('Grade').querySelectorAll('option'),
    ).toHaveLength(10)
    expect(
      screen.queryByRole('option', { name: 'ISC' }),
    ).not.toBeInTheDocument()
  })
  it('adds unclaimed student without inventing global identity', async () => {
    mount(<StudentsScreen schoolId="school-a" />)
    await screen.findByRole('option', { name: 'CBSE · Class 3 A' })
    fireEvent.change(screen.getByLabelText('School student reference'), {
      target: { value: 'REF-1' },
    })
    fireEvent.change(screen.getByLabelText('Student display name'), {
      target: { value: 'Student Example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add student record' }))
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://platform.test/api/v1/schools/school-a/classes/class-a/roster',
        expect.objectContaining({
          body: '{"externalId":"REF-1","displayName":"Student Example"}',
        }),
      ),
    )
  })
  it('links only an explicitly selected active school student membership', async () => {
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      url.includes('/memberships')
        ? Promise.resolve(
            reply({
              items: [
                {
                  id: 'student-member',
                  name: 'Student Member',
                  email: 'student@example.test',
                  role: 'STUDENT',
                  status: 'ACTIVE',
                },
                {
                  id: 'parent-member',
                  name: 'Parent Member',
                  email: 'parent@example.test',
                  role: 'PARENT',
                  status: 'ACTIVE',
                },
                {
                  id: 'suspended-student',
                  name: 'Suspended Student',
                  email: 'suspended@example.test',
                  role: 'STUDENT',
                  status: 'SUSPENDED',
                },
              ],
              nextCursor: null,
            }),
          )
        : baseFetch(url, request),
    )
    mount(<StudentsScreen schoolId="school-a" />)
    await screen.findByRole('option', {
      name: 'Student Member · student@example.test',
    })
    expect(
      screen.queryByRole('option', { name: /Parent Member/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Suspended Student/ }),
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('School student reference'), {
      target: { value: 'REF-LINK' },
    })
    fireEvent.change(screen.getByLabelText('Student display name'), {
      target: { value: 'Student Member' },
    })
    fireEvent.change(
      screen.getByLabelText('Existing student membership (optional)'),
      { target: { value: 'student-member' } },
    )
    expect(
      screen.getByLabelText('Selected student membership ID for CSV'),
    ).toHaveValue('student-member')
    fireEvent.click(screen.getByRole('button', { name: 'Add student record' }))
    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://platform.test/api/v1/schools/school-a/classes/class-a/roster',
        expect.objectContaining({
          body: '{"externalId":"REF-LINK","displayName":"Student Member","membershipId":"student-member"}',
        }),
      ),
    )
  })
  it('CSV errors are visible and prevent commit', async () => {
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      url.endsWith('/preview')
        ? Promise.resolve(
            reply({
              totalRows: 1,
              valid: false,
              rows: [],
              errors: [
                {
                  row: 2,
                  code: 'CLASS',
                  message: 'Class is outside this school',
                },
              ],
            }),
          )
        : baseFetch(url, request),
    )
    mount(<StudentsScreen schoolId="school-a" />)
    fireEvent.change(screen.getByLabelText('CSV content'), {
      target: {
        value: 'externalId,displayName,classId,membershipId\nX,Name,foreign,',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByLabelText('CSV import errors')).toHaveTextContent(
      'Row 2: Class is outside this school',
    )
    expect(
      screen.getByRole('button', { name: 'Commit reviewed import' }),
    ).toBeDisabled()
  })
  it('failed commit retry uses same reviewed CSV and idempotency key, then stops duplicate submits', async () => {
    let commits = 0
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      url.endsWith('/preview')
        ? Promise.resolve(
            reply({
              totalRows: 1,
              valid: true,
              errors: [],
              rows: [
                {
                  row: 2,
                  externalId: 'REF1',
                  displayName: 'Name',
                  classId: 'class-a',
                },
              ],
            }),
          )
        : url.endsWith('/commit')
          ? Promise.resolve(reply({ count: 1 }, ++commits === 1 ? 503 : 200))
          : baseFetch(url, request),
    )
    mount(<StudentsScreen schoolId="school-a" />)
    const csv =
      'externalId,displayName,classId,membershipId\nREF1,Name,class-a,'
    fireEvent.change(screen.getByLabelText('CSV content'), {
      target: { value: csv },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Commit reviewed import' }),
    )
    await screen.findByRole('alert')
    expect(screen.getByLabelText('CSV content')).toHaveValue(csv)
    fireEvent.click(
      screen.getByRole('button', { name: 'Commit reviewed import' }),
    )
    await screen.findByText(/Imported 1 roster entries/)
    const bodies = mocks.fetch.mock.calls
      .filter(([url]) => String(url).endsWith('/commit'))
      .map(([, request]) => JSON.parse(request.body))
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toEqual(bodies[1])
    expect(bodies[0].idempotencyKey).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Commit reviewed import' }),
    ).toBeDisabled()
  })
  it('editing reviewed CSV removes stale commit permission', async () => {
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      url.endsWith('/preview')
        ? Promise.resolve(
            reply({ totalRows: 0, valid: true, errors: [], rows: [] }),
          )
        : baseFetch(url, request),
    )
    mount(<StudentsScreen schoolId="school-a" />)
    fireEvent.change(screen.getByLabelText('CSV content'), {
      target: { value: 'first draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await screen.findByRole('button', { name: 'Commit reviewed import' })
    fireEvent.change(screen.getByLabelText('CSV content'), {
      target: { value: 'edited draft' },
    })
    expect(
      screen.queryByRole('button', { name: 'Commit reviewed import' }),
    ).not.toBeInTheDocument()
  })
  it('rejects oversized CSV files and removes any previous commit permission', async () => {
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      url.endsWith('/preview')
        ? Promise.resolve(
            reply({ totalRows: 0, valid: true, errors: [], rows: [] }),
          )
        : baseFetch(url, request),
    )
    mount(<StudentsScreen schoolId="school-a" />)
    fireEvent.change(screen.getByLabelText('CSV content'), {
      target: { value: 'retained CSV draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await screen.findByRole('button', { name: 'Commit reviewed import' })
    fireEvent.change(screen.getByLabelText('CSV file'), {
      target: {
        files: [
          new File([new Uint8Array(131073)], 'too-large.csv', {
            type: 'text/csv',
          }),
        ],
      },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('128 KB')
    expect(
      screen.queryByRole('button', { name: 'Commit reviewed import' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('CSV content')).toHaveValue(
      'retained CSV draft',
    )
  })
  it('teacher invitation is bound and no platformadmin grant control exists', async () => {
    mocks.fetch.mockImplementation((url: string, request: RequestInit) =>
      url.endsWith('/invitations') && request?.method === 'POST'
        ? Promise.resolve(
            reply({
              id: 'invite-a',
              email: 'teacher@example.test',
              role: 'TEACHER',
              status: 'PENDING',
              token: 'opaque-code',
              expiresAt: '2026-10-20',
            }),
          )
        : baseFetch(url, request),
    )
    mount(<StaffScreen schoolId="school-a" />)
    fireEvent.change(screen.getByLabelText('Invitation email'), {
      target: { value: 'teacher@example.test' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Create bound invitation' }),
    )
    expect(await screen.findByLabelText('Invitation code')).toHaveValue(
      'opaque-code',
    )
    expect(
      screen
        .getByLabelText('School membership role')
        .querySelectorAll('option'),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('option', { name: /admin/i }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Hide invitation code' }),
    )
    expect(screen.queryByLabelText('Invitation code')).not.toBeInTheDocument()
  })
  it('school teacher uses own-assignment API without roster queries', async () => {
    mount(<ClassroomScreen schoolId="school-a" />)
    await screen.findByText('No assigned classes yet')
    expect(
      mocks.fetch.mock.calls.some(([url]) =>
        String(url).includes('/my-teaching-assignments'),
      ),
    ).toBe(true)
    expect(
      mocks.fetch.mock.calls.some(([url]) => String(url).includes('/roster')),
    ).toBe(false)
  })
  it('invitation token comes only from form, acceptance cannot selfgrant role', async () => {
    mount(<InvitationEntry />)
    fireEvent.change(screen.getByLabelText('School invitation code'), {
      target: { value: 'bound-secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))
    await screen.findByText(/School membership activated/)
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://platform.test/api/v1/school-identity/invitations/accept',
      expect.objectContaining({ body: '{"token":"bound-secret"}' }),
    )
    expect(
      screen.getByRole('button', { name: 'Accept invitation' }),
    ).toBeDisabled()
  })
  it('verified workspace roles come from backend and parent has no forged route', async () => {
    mocks.fetch.mockImplementation((url: string) =>
      url.endsWith('/profile')
        ? Promise.resolve(reply({ emailVerified: true }))
        : Promise.resolve(
            reply({
              items: [
                {
                  membershipId: 'admin-a',
                  schoolId: 'school-a',
                  schoolName: 'School A',
                  role: 'SCHOOL_ADMIN',
                  status: 'ACTIVE',
                },
                {
                  membershipId: 'parent-a',
                  schoolId: 'school-a',
                  schoolName: 'School A',
                  role: 'PARENT',
                  status: 'ACTIVE',
                },
              ],
              nextCursor: null,
            }),
          ),
    )
    mocks.select.mockResolvedValue({ href: '/org/school-a/academics' })
    mount(<WorkspaceEntry personalHref="/dashboard" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Open workspace' }),
    )
    await waitFor(() =>
      expect(mocks.select).toHaveBeenCalledWith('admin-a', expect.anything()),
    )
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/org/school-a/academics'),
    )
    expect(
      screen.queryByRole('link', { name: /parent workspace/i }),
    ).not.toBeInTheDocument()
  })
  it('email delivery failure does not claim that a code was sent', async () => {
    mocks.fetch.mockImplementation((url: string) =>
      url.endsWith('/profile')
        ? Promise.resolve(reply({ emailVerified: false }))
        : url.endsWith('/request')
          ? Promise.resolve(reply({}, 503))
          : Promise.resolve(reply({ items: [], nextCursor: null })),
    )
    mount(<WorkspaceEntry personalHref="/dashboard" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Send verification code' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByText(/Request completed/)).not.toBeInTheDocument()
  })
})
