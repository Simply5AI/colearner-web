import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminUserActionMenu } from '@/components/admin/admin-user-detail/action-menu'
import type { AdminUserDetail } from '@/lib/api/admin'

const refreshMock = vi.hoisted(() => vi.fn())
const suspendMock = vi.hoisted(() => vi.fn())
const reactivateMock = vi.hoisted(() => vi.fn())
const resetMock = vi.hoisted(() => vi.fn())
const deleteMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock('@/lib/hooks/use-admin-mutation', () => ({
  useAdminMutation: () => ({
    runSensitive: <T,>(fn: () => Promise<T>) => fn(),
  }),
}))

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    suspendAdminUser: suspendMock,
    reactivateAdminUser: reactivateMock,
    resetAdminUserPassword: resetMock,
    deleteAdminUser: deleteMock,
  }
})

function makeDetail(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    avatarUrl: null,
    systemRole: 'MEMBER',
    status: 'ACTIVE',
    org: { id: 'org-1', name: 'Demo Org', slug: 'demo', type: 'TEAM' },
    lastActiveAt: '2026-05-20T10:00:00.000Z',
    createdAt: '2026-05-01T10:00:00.000Z',
    suspendedAt: null,
    deletedAt: null,
    suspendedBy: null,
    suspensionReason: null,
    updatedAt: '2026-05-20T10:00:00.000Z',
    onboardingCompleted: true,
    bio: null,
    roles: [],
    subscription: null,
    activityCount: 0,
    availableRoles: [],
    ...overrides,
  }
}

describe('AdminUserActionMenu', () => {
  beforeEach(() => {
    refreshMock.mockReset()
    suspendMock.mockReset()
    reactivateMock.mockReset()
    resetMock.mockReset()
    deleteMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('suspends an active user with a reason', async () => {
    const user = userEvent.setup()
    suspendMock.mockResolvedValue(makeDetail({ status: 'SUSPENDED' }))

    render(
      <AdminUserActionMenu
        detail={makeDetail()}
        currentAdminId="admin-1"
        authHeaders={{}}
      />
    )

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /suspend/i }))
    await user.type(screen.getByLabelText(/reason/i), 'Policy review')
    await user.click(screen.getByRole('button', { name: /^suspend$/i }))

    await waitFor(() => {
      expect(suspendMock).toHaveBeenCalledWith({}, 'user-1', { reason: 'Policy review' })
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Suspended ada@example.com')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('reactivates a suspended user', async () => {
    const user = userEvent.setup()
    reactivateMock.mockResolvedValue(makeDetail())

    render(
      <AdminUserActionMenu
        detail={makeDetail({ status: 'SUSPENDED', suspendedAt: '2026-05-10T10:00:00.000Z' })}
        currentAdminId="admin-1"
        authHeaders={{}}
      />
    )

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /reactivate/i }))
    await user.click(screen.getByRole('button', { name: /^reactivate$/i }))

    await waitFor(() => {
      expect(reactivateMock).toHaveBeenCalledWith({}, 'user-1')
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Reactivated ada@example.com')
  })
})