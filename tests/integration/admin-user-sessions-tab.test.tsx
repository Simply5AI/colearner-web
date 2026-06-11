import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionsTab } from '@/components/admin/admin-user-detail/sessions-tab'

const getSessionsMock = vi.hoisted(() => vi.fn())
const forceLogoutMock = vi.hoisted(() => vi.fn())
const revokeMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    getAdminUserSessions: getSessionsMock,
    forceLogoutAdminUser: forceLogoutMock,
    revokeAdminUserSession: revokeMock,
  }
})

describe('SessionsTab', () => {
  beforeEach(() => {
    getSessionsMock.mockReset()
    forceLogoutMock.mockReset()
    revokeMock.mockReset()
    toastSuccessMock.mockReset()
    getSessionsMock.mockResolvedValue([
      {
        tokenId: 'token-abc-123',
        expiresAt: '2026-12-01T10:00:00.000Z',
        isExpired: false,
      },
    ])
  })

  it('force-logouts all sessions for the user', async () => {
    const user = userEvent.setup()
    forceLogoutMock.mockResolvedValue({ success: true })

    render(<SessionsTab userId="user-1" authHeaders={{}} />)

    await waitFor(() => {
      expect(screen.getByText(/token-abc/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /force logout all/i }))
    await user.click(screen.getByRole('button', { name: /^force logout$/i }))

    await waitFor(() => {
      expect(forceLogoutMock).toHaveBeenCalledWith({}, 'user-1')
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('All sessions revoked')
    expect(screen.getByText('No active sessions')).toBeInTheDocument()
  })
})