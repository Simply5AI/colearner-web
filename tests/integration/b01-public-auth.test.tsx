import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { LoginForm } from '@/components/auth/login-form'
import { SignupForm } from '@/components/auth/signup-form'
import { ForgotPasswordForm, maskEmail } from '@/components/auth/forgot-password-form'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { AgePreviews } from '@/components/landing/age-previews'
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), getSession: vi.fn(), registerUser: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), search: new URLSearchParams(), push: vi.fn() }))
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn, getSession: mocks.getSession }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }), useSearchParams: () => mocks.search }))
vi.mock('@/lib/api/auth', () => ({ registerUser: mocks.registerUser, forgotPassword: mocks.forgotPassword, resetPassword: mocks.resetPassword }))
vi.mock('react-google-recaptcha-v3', () => ({ useGoogleReCaptcha: () => ({ executeRecaptcha: undefined }), GoogleReCaptchaProvider: ({ children }: { children: React.ReactNode }) => children }))
beforeEach(() => { vi.clearAllMocks(); mocks.search = new URLSearchParams() })
async function fillLogin(user: ReturnType<typeof userEvent.setup>) { await user.type(screen.getByLabelText('Email'), 'person@example.test'); await user.type(screen.getByLabelText('Password'), 'Password123') }
describe('B01 authentication forms', () => {
  it('keeps show/hide keyboard accessible and links validation messages', async () => {
    const serverDocument = new DOMParser().parseFromString(renderToString(<LoginForm />), 'text/html')
    expect(serverDocument.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true)
    expect(serverDocument.querySelector('input[type="email"]')?.hasAttribute('disabled')).toBe(true)
    expect(serverDocument.querySelector('input[type="password"]')?.hasAttribute('disabled')).toBe(true)
    const user = userEvent.setup(); render(<LoginForm />)
    expect(screen.getByLabelText('Password').closest('form')).toHaveAttribute('method', 'post')
    const show = screen.getByRole('button', { name: 'Show password' }); expect(show).not.toHaveAttribute('tabindex', '-1')
    await user.click(show); expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error'); expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('preserves details and permits real sign-in retry without invented lockout counts', async () => {
    mocks.signIn.mockResolvedValue({ error: 'CredentialsSignin' }); const user = userEvent.setup(); render(<LoginForm />); await fillLogin(user)
    await user.click(screen.getByRole('button', { name: 'Log in' })); expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in')
    expect(screen.getByLabelText('Email')).toHaveValue('person@example.test'); expect(screen.queryByText(/attempts remaining|15 minutes/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try signing in again' })); await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(2))
  })
  it('does not navigate without a verified backend identity', async () => {
    mocks.signIn.mockResolvedValue({ ok: true }); mocks.getSession.mockResolvedValue({ user: { id: '' } }); const user = userEvent.setup(); render(<LoginForm />); await fillLogin(user)
    await user.click(screen.getByRole('button', { name: 'Log in' })); expect(await screen.findByRole('alert')).toHaveTextContent('session could not be established')
  })
  it('announces pending sign-in and prevents duplicate submissions', async () => {
    let finish: (value: { error: string }) => void = () => undefined
    mocks.signIn.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const user = userEvent.setup(); render(<LoginForm />); await fillLogin(user)
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Signing in. Please wait.')
    await user.click(screen.getByRole('button', { name: 'Signing in…' }))
    expect(mocks.signIn).toHaveBeenCalledTimes(1)
    finish({ error: 'CredentialsSignin' })
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in')
  })
  it('supports configured Google initiation errors', async () => {
    mocks.signIn.mockRejectedValue(new Error('unavailable')); const user = userEvent.setup(); render(<LoginForm googleEnabled />)
    await user.click(screen.getByRole('button', { name: 'Continue with Google' })); expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in is unavailable')
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled(); expect(mocks.signIn).toHaveBeenCalledWith('google', { callbackUrl: '/' })
  })
  it('gates minimal registration notices without collecting child identity', async () => {
    mocks.registerUser.mockResolvedValue({}); mocks.signIn.mockResolvedValue({ error: 'unavailable' }); const user = userEvent.setup(); render(<SignupForm />)
    expect(screen.getByLabelText('Password', { exact: true }).closest('form')).toHaveAttribute('method', 'post')
    expect(screen.queryByLabelText(/name|school/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/child name|school name/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'adult@example.test')
    await user.type(screen.getByLabelText('Password', { exact: true }), 'Password123'); await user.type(screen.getByLabelText('Confirm password'), 'Password123'); await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('You must accept the terms and conditions')).toBeInTheDocument(); expect(mocks.registerUser).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox', { name: /current terms notice/ })); await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(mocks.registerUser).toHaveBeenCalledWith({ email: 'adult@example.test', password: 'Password123', acceptedTerms: true, recaptchaToken: undefined })); expect(mocks.push).toHaveBeenCalledWith('/login?registered=true&callbackUrl=%2Fage')
  })
  it('confirms masked reset request without asserting account existence', async () => {
    mocks.forgotPassword.mockResolvedValue(undefined); const user = userEvent.setup(); render(<ForgotPasswordForm />)
    expect(screen.getByLabelText('Email').closest('form')).toHaveAttribute('method', 'post')
    await user.type(screen.getByLabelText('Email'), 'student@example.test'); await user.click(screen.getByRole('button', { name: 'Send reset instructions' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists for s•••@example.test'); expect(mocks.forgotPassword).toHaveBeenCalledWith('student@example.test', undefined)
    await user.click(screen.getByRole('button', { name: 'Try another email' })); expect(screen.getByLabelText('Email')).toHaveValue('student@example.test'); expect(maskEmail('a@school.test')).toBe('a•••@school.test')
  })
  it('uses generic reset unavailability and allows retry', async () => {
    mocks.forgotPassword.mockRejectedValue(new Error('Account does not exist')); const user = userEvent.setup(); render(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText('Email'), 'unknown@example.test'); await user.click(screen.getByRole('button', { name: 'Send reset instructions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable right now'); expect(screen.queryByText('Account does not exist')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })
  it('rejects incomplete reset links', () => { render(<ResetPasswordForm />); expect(screen.getByRole('alert')).toHaveTextContent('reset link is incomplete'); expect(mocks.resetPassword).not.toHaveBeenCalled() })
  it('validates matching and uses real token with API-confirmed success', async () => {
    mocks.search = new URLSearchParams({ token: 'test-only-reset-evidence' }); mocks.resetPassword.mockResolvedValue(undefined); const user = userEvent.setup(); render(<ResetPasswordForm />)
    expect(screen.getByLabelText('New password', { exact: true }).closest('form')).toHaveAttribute('method', 'post')
    await user.type(screen.getByLabelText('New password', { exact: true }), 'Password123'); await user.type(screen.getByLabelText('Confirm new password'), 'different'); await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument(); expect(mocks.resetPassword).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Confirm new password')); await user.type(screen.getByLabelText('Confirm new password'), 'Password123'); await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument(); expect(mocks.resetPassword).toHaveBeenCalledWith({ token: 'test-only-reset-evidence', newPassword: 'Password123' })
  })
  it('keeps a failed reset reviewable and links to fresh reset evidence', async () => {
    mocks.search = new URLSearchParams({ token: 'used-test-evidence' }); mocks.resetPassword.mockRejectedValue(new Error('expired'))
    const user = userEvent.setup(); render(<ResetPasswordForm />)
    await user.type(screen.getByLabelText('New password', { exact: true }), 'Password123'); await user.type(screen.getByLabelText('Confirm new password'), 'Password123')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('expired or already used')
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByLabelText('New password', { exact: true })).toHaveValue('Password123')
    expect(screen.queryByRole('heading', { name: 'Password updated' })).not.toBeInTheDocument()
  })
  it('switches all four visual age previews', async () => {
    const user = userEvent.setup(); render(<AgePreviews />)
    for (const label of ['Ages 6–9', 'Ages 10–13', 'Ages 14–17', 'Adult learners']) { await user.click(screen.getByRole('button', { name: label })); expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true'); expect(screen.getByText(`Design preview · ${label}`)).toBeInTheDocument() }
    expect(screen.getByText('Retained design direction; school learners come first.')).toBeInTheDocument()
  })
})
