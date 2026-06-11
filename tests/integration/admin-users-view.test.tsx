import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminUsersView } from '@/components/admin/admin-users-view'
import type { AdminUsersQuery, AdminUsersResponse } from '@/lib/api/admin'

const replaceMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())
const suspendMock = vi.hoisted(() => vi.fn())
const reactivateMock = vi.hoisted(() => vi.fn())
const deleteMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastWarningMock = vi.hoisted(() => vi.fn())
let searchParamsValue = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'token' } }),
}))

vi.mock('@/lib/hooks/use-admin-mutation', () => ({
  useAdminMutation: () => ({
    runSensitive: <T,>(fn: () => Promise<T>) => fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    warning: toastWarningMock,
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    suspendAdminUsers: suspendMock,
    reactivateAdminUsers: reactivateMock,
    deleteAdminUsers: deleteMock,
  }
})

function makeUsers(overrides: Partial<AdminUsersResponse> = {}): AdminUsersResponse {
  return {
    total: 2,
    nextCursor: '25',
    items: [
      makeUser({ id: 'admin-1', email: 'admin@example.com', name: 'Admin User', systemRole: 'SUPER_ADMIN' }),
      makeUser({ id: 'user-1', email: 'ada@example.com', name: 'Ada Lovelace' }),
    ],
    ...overrides,
  }
}

function makeUser(overrides: Partial<AdminUsersResponse['items'][number]> = {}): AdminUsersResponse['items'][number] {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    avatarUrl: null,
    systemRole: 'MEMBER',
    status: 'ACTIVE',
    org: {
      id: 'org-1',
      name: 'Demo Org',
      slug: 'demo',
      type: 'TEAM',
    },
    lastActiveAt: '2026-05-20T10:00:00.000Z',
    createdAt: '2026-05-01T10:00:00.000Z',
    suspendedAt: null,
    deletedAt: null,
    ...overrides,
  }
}

function renderView(data = makeUsers(), query: AdminUsersQuery = {}) {
  return render(<AdminUsersView data={data} query={{ sort: 'created_desc', limit: 25, ...query }} currentAdminId="admin-1" />)
}

describe('AdminUsersView', () => {
  beforeEach(() => {
    searchParamsValue = ''
    replaceMock.mockReset()
    refreshMock.mockReset()
    suspendMock.mockReset()
    reactivateMock.mockReset()
    deleteMock.mockReset()
    toastSuccessMock.mockReset()
    toastWarningMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders users, badges, totals, and disabled export', () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(screen.getByText('2 total')).toBeInTheDocument()
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Super Admin')).toBeInTheDocument()
    expect(screen.getAllByText('Active')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled()
  })

  it('shows an empty state with reset filters', () => {
    renderView({ total: 0, nextCursor: null, items: [] })

    expect(screen.getByText('No users found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument()
  })

  it('debounces search into the URL query string', async () => {
    renderView()

    fireEvent.change(screen.getByPlaceholderText(/search email/i), {
      target: { value: 'ada' },
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/admin/users?search=ada', { scroll: false })
    }, { timeout: 1000 })
  })

  it('updates cursor pagination in the URL', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(replaceMock).toHaveBeenCalledWith('/admin/users?cursor=25', { scroll: false })
  })

  it('persists selected ids across page rerenders', async () => {
    const user = userEvent.setup()
    const { rerender } = renderView()

    await user.click(screen.getByLabelText('Select ada@example.com'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    rerender(
      <AdminUsersView
        data={{
          total: 2,
          nextCursor: null,
          items: [makeUser({ id: 'user-2', email: 'grace@example.com', name: 'Grace Hopper' })],
        }}
        query={{ sort: 'created_desc', cursor: '25', limit: 25 }}
        currentAdminId="admin-1"
      />
    )

    await user.click(screen.getByLabelText('Select grace@example.com'))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('disables selecting the current admin account', () => {
    renderView()

    expect(screen.getByLabelText('Cannot select your own account')).toHaveAttribute('aria-disabled', 'true')
  })

  it('runs bulk reactivate and reports successful results', async () => {
    const user = userEvent.setup()
    reactivateMock.mockResolvedValue({ succeeded: ['user-1'], failed: [] })
    renderView(makeUsers({
      items: [makeUser({ id: 'user-1', status: 'SUSPENDED', suspendedAt: '2026-05-10T10:00:00.000Z' })],
    }))

    await user.click(screen.getByLabelText('Select ada@example.com'))
    await user.click(screen.getByRole('button', { name: /^reactivate$/i }))
    await user.click(screen.getByRole('button', { name: /reactivate users/i }))

    await waitFor(() => {
      expect(reactivateMock).toHaveBeenCalledWith({}, { userIds: ['user-1'] })
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('1 user reactivated')
  })

  it('runs bulk suspend and reports successful results', async () => {
    const user = userEvent.setup()
    suspendMock.mockResolvedValue({ succeeded: ['user-1'], failed: [] })
    renderView()

    await user.click(screen.getByLabelText('Select ada@example.com'))
    await user.click(screen.getByRole('button', { name: /^suspend$/i }))
    await user.type(screen.getByLabelText(/suspension reason/i), 'Policy review')
    await user.click(screen.getByRole('button', { name: /suspend users/i }))

    await waitFor(() => {
      expect(suspendMock).toHaveBeenCalledWith({}, { userIds: ['user-1'], reason: 'Policy review' })
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('1 user suspended')
    expect(refreshMock).toHaveBeenCalled()
  })
})
