import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgSetupForm } from '@/components/teacher/org-setup-form'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockUpdate = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ update: mockUpdate }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api/teacher-client', () => ({
  bootstrapFreelanceOrgClient: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    orgName: 'Test School',
    role: 'TEACHER',
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  }),
}))

describe('OrgSetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits bootstrap payload and refreshes session', async () => {
    const user = userEvent.setup()
    render(<OrgSetupForm defaultDisplayName="Ada School" />)

    await user.clear(screen.getByLabelText('Organization display name'))
    await user.type(screen.getByLabelText('Organization display name'), 'Ada School')
    await user.click(screen.getByRole('button', { name: 'Create teacher organization' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        onboardingCompleted: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
    })

    expect(mockPush).toHaveBeenCalledWith('/teacher/onboarding')
    expect(mockRefresh).toHaveBeenCalled()
  })
})