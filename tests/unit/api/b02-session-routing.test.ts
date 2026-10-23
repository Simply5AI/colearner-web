// @vitest-environment node
import type { NextAuthConfig } from 'next-auth'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const capture = vi.hoisted(() => ({
  config: undefined as NextAuthConfig | undefined,
}))
const api = vi.hoisted(() => ({
  login: vi.fn(),
  validateSession: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('next-auth', () => ({
  CredentialsSignin: class { code = 'credentials' },
  default: (config: NextAuthConfig) => {
    capture.config = config
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }
  },
}))
vi.mock('next-auth/providers/google', () => ({
  default: (options: unknown) => ({ id: 'google', options }),
}))
vi.mock('next-auth/providers/credentials', () => ({
  default: (options: unknown) => ({
    id: 'credentials',
    ...(options as object),
  }),
}))
vi.mock('@/lib/api/platform-client', () => ({
  platformClient: () => api,
  platformApiBaseUrl: () => 'https://api.example.test/api/v1',
}))
vi.mock('@/lib/api/auth', () => ({ loginUser: api.login }))
import '@/lib/auth/config'
import { config as middlewareConfig } from '@/middleware'
interface ProviderUser {
  id: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshRequestId: string
}
interface Token {
  [key: string]: unknown
  accessToken?: string
  accessTokenExpires?: number
}
const callbacks = () =>
  capture.config!.callbacks as unknown as {
    jwt(args: {
      token: Token
      user?: ProviderUser
      trigger?: string
      session?: Record<string, unknown>
    }): Promise<Token>
    authorized(args: {
      auth: unknown
      request: { nextUrl: URL }
    }): boolean | Response
  }
const authorize = () =>
  (
    capture.config!.providers.find(
      (provider) =>
        typeof provider === 'object' && provider.id === 'credentials',
    ) as unknown as {
      authorize(
        credentials: Record<string, string>,
      ): Promise<ProviderUser | null>
    }
  ).authorize
describe('B02 authentication handoff and refresh routing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'))
    vi.clearAllMocks()
    api.login.mockResolvedValue({
      accessToken: 'access-a',
      refreshToken: 'refresh-a',
      expiresIn: 900,
      refreshRequestId: 'request-a',
    })
    api.validateSession.mockResolvedValue({
      userId: 'verified-user',
      refreshRequestId: 'verified-request',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: 'verified-user',
              roles: [],
              onboardingCompleted: true,
            },
          }),
        ),
      ),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('retains server credential expiry and operation ID through provider authorize', async () => {
    const user = await authorize()({
      email: 'school@example.test',
      password: 'fictional',
    })
    expect(user).toMatchObject({
      expiresIn: 900,
      refreshRequestId: 'request-a',
    })
    const token = await callbacks().jwt({ token: {}, user: user! })
    expect(token.accessTokenExpires).toBe(Date.now() + 840000)
    expect(token.refreshRequestId).toBe('verified-request')
    expect(api.validateSession).toHaveBeenCalledWith('access-a', 'refresh-a')
  })
  it('does not prematurely refresh a valid credential session after sixty seconds', async () => {
    const user = await authorize()({
      email: 'school@example.test',
      password: 'fictional',
    })
    const token = await callbacks().jwt({ token: {}, user: user! })
    vi.advanceTimersByTime(61000)
    const next = await callbacks().jwt({ token })
    expect(next.accessToken).toBe('access-a')
    expect(api.refresh).not.toHaveBeenCalled()
  })
  it.each([undefined, 0, -1, Number.NaN])(
    'rejects invalid server credential lifetime %s',
    async (expiresIn) => {
      api.login.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn,
      })
      expect(
        await authorize()({
          email: 'school@example.test',
          password: 'fictional',
        }),
      ).toBeNull()
    },
  )
  it('ignores browser claimed roles and lifetime during updates', async () => {
    const token = {
      backendUserId: 'verified-user',
      accessToken: 'a',
      refreshToken: 'r',
      refreshRequestId: 'id',
      accessTokenExpires: Date.now() + 900000,
    }
    const next = await callbacks().jwt({
      token,
      trigger: 'update',
      session: {
        roles: ['SCHOOL_ADMIN'],
        systemRole: 'SUPER_ADMIN',
        expiresIn: 999999999,
      },
    })
    expect(next.roles).toEqual([])
    expect(next.accessTokenExpires).toBe(token.accessTokenExpires)
  })
  it.each(['/org/a/academics', '/workspaces', '/invite'])(
    'anonymous school path %s redirects to sign-in',
    (path) => {
      const result = callbacks().authorized({
        auth: null,
        request: { nextUrl: new URL(path, 'https://colearner.test') },
      }) as Response
      expect(result.status).toBe(302)
      const location = new URL(result.headers.get('Location')!)
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('callbackUrl')).toBe(path)
    },
  )
  it('keeps school teacher invitation entry available to signed-in personal accounts', () => {
    expect(
      callbacks().authorized({
        auth: { user: { roles: [] }, accessToken: 'a' },
        request: { nextUrl: new URL('https://colearner.test/teacher/signup') },
      }),
    ).toBe(true)
  })
  it('middleware covers school entry and root so navigation refresh can persist cookie', () => {
    expect(middlewareConfig.matcher).toEqual(
      expect.arrayContaining(['/', '/workspaces', '/invite', '/org/:path*']),
    )
    expect(
      callbacks().authorized({
        auth: { user: { roles: ['TEACHER'] }, accessToken: 'a' },
        request: { nextUrl: new URL('https://colearner.test/') },
      }),
    ).toBe(true)
  })
})
