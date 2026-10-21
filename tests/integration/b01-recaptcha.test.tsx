import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleReCaptchaContext } from 'react-google-recaptcha-v3'
import { ForgotPasswordContent, ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { SignupForm } from '@/components/auth/signup-form'
import { RecaptchaProvider } from '@/components/auth/recaptcha-provider'

// The reCAPTCHA library is intentionally NOT mocked. These regressions use its
// actual default/provider context; only application network calls are isolated.
const api = vi.hoisted(() => ({ forgotPassword: vi.fn(), registerUser: vi.fn(), signIn: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ forgotPassword: api.forgotPassword, registerUser: api.registerUser }))
vi.mock('next-auth/react', () => ({ signIn: api.signIn, getSession: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', '') })
afterEach(() => { vi.unstubAllEnvs() })

async function submitForgot(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'adult@example.test')
  await user.click(screen.getByRole('button', { name: 'Send reset instructions' }))
}
async function fillSignup(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'adult@example.test')
  await user.type(screen.getByLabelText('Password', { exact: true }), 'Password123')
  await user.type(screen.getByLabelText('Confirm password'), 'Password123')
  await user.click(screen.getByRole('checkbox', { name: /current terms notice/ }))
}
describe('actual optional reCAPTCHA context', () => {
  it('issues forgot-password request without a key despite the library default thrower', async () => {
    api.forgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup(); render(<ForgotPasswordContent />)
    await submitForgot(user)
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
    expect(api.forgotPassword).toHaveBeenCalledWith('adult@example.test', undefined)
  })
  it('issues registration without a key using the real missing-provider context', async () => {
    api.registerUser.mockResolvedValue({}); api.signIn.mockResolvedValue({ error: 'isolated-session-unavailable' })
    const user = userEvent.setup(); render(<RecaptchaProvider><SignupForm /></RecaptchaProvider>)
    await fillSignup(user); await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(api.registerUser).toHaveBeenCalledWith({ email: 'adult@example.test', password: 'Password123', acceptedTerms: true, recaptchaToken: undefined }))
  })
  it('blocks configured verification with no ready executor and supports a later retry', async () => {
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', 'test-only-site-key')
    api.forgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const view = render(<GoogleReCaptchaContext.Provider value={{ executeRecaptcha: undefined }}><ForgotPasswordForm /></GoogleReCaptchaContext.Provider>)
    await submitForgot(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable right now')
    expect(api.forgotPassword).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email')).toHaveValue('adult@example.test')
    const execute = vi.fn().mockResolvedValue('test-only-verification-token')
    view.rerender(<GoogleReCaptchaContext.Provider value={{ executeRecaptcha: execute }}><ForgotPasswordForm /></GoogleReCaptchaContext.Provider>)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
    expect(execute).toHaveBeenCalledWith('forgot_password')
    expect(api.forgotPassword).toHaveBeenCalledWith('adult@example.test', 'test-only-verification-token')
  })
  it('does not bypass a configured executor rejection', async () => {
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', 'test-only-site-key')
    const execute = vi.fn().mockRejectedValue(new Error('test script failure'))
    const user = userEvent.setup(); render(<GoogleReCaptchaContext.Provider value={{ executeRecaptcha: execute }}><ForgotPasswordForm /></GoogleReCaptchaContext.Provider>)
    await submitForgot(user)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(execute).toHaveBeenCalledWith('forgot_password')
    expect(api.forgotPassword).not.toHaveBeenCalled()
  })
  it('blocks configured signup if verification has not become ready', async () => {
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', 'test-only-site-key')
    const user = userEvent.setup(); render(<GoogleReCaptchaContext.Provider value={{ executeRecaptcha: undefined }}><SignupForm /></GoogleReCaptchaContext.Provider>)
    await fillSignup(user); await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verification is unavailable right now')
    expect(api.registerUser).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Try creating account again' })).toBeEnabled()
  })
  it('rejects an empty configured verification token instead of submitting without it', async () => {
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', 'test-only-site-key')
    const user = userEvent.setup(); render(<GoogleReCaptchaContext.Provider value={{ executeRecaptcha: async () => '' }}><ForgotPasswordForm /></GoogleReCaptchaContext.Provider>)
    await submitForgot(user)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(api.forgotPassword).not.toHaveBeenCalled()
  })
})
