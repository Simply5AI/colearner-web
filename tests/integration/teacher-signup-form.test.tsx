import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherSignupForm } from '@/components/teacher/teacher-signup-form'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockUpdate = vi.fn()
const mockSignIn = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ update: mockUpdate }),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/api/auth', () => ({
  registerUser: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
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

describe('TeacherSignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ error: null })
  })

  it('registers, signs in, bootstraps, and routes to teacher onboarding', async () => {
    const user = userEvent.setup()
    render(<TeacherSignupForm />)

    await user.type(screen.getByLabelText('Your name'), 'Ada Teacher')
    await user.type(screen.getByLabelText('Email'), 'ada@school.test')
    await user.type(screen.getByLabelText('Password'), 'TestPassword123!')
    await user.type(screen.getByLabelText('School / organization name'), 'Ada School')
    await user.click(screen.getByRole('button', { name: 'Create teacher account' }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled()
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