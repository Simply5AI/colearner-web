// @vitest-environment node
import type { NextAuthConfig } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const capture = vi.hoisted(() => ({ config: undefined as NextAuthConfig | undefined }))
const api = vi.hoisted(() => ({ validateSession: vi.fn(), exchangeGoogle: vi.fn(), refresh: vi.fn() }))
vi.mock('next-auth', () => ({ default: (config: NextAuthConfig) => { capture.config = config; return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() } } }))
vi.mock('next-auth/providers/google', () => ({ default: (options: unknown) => ({ id: 'google', options }) }))
vi.mock('next-auth/providers/credentials', () => ({ default: (options: unknown) => options }))
vi.mock('@/lib/api/platform-client', () => ({ platformClient: () => api, platformApiBaseUrl: () => 'https://api.example.test/api/v1' }))
vi.mock('@/lib/api/auth', () => ({ loginUser: vi.fn() }))
import '@/lib/auth/config'

interface Token { [key: string]: unknown; accessToken?: string; backendUserId?: string }
interface CallbackSession { accessToken?: string; user: { id: string; name: string; email: string; roles?: string[]; systemRole?: string }; expires: string }
const callbacks = () => capture.config!.callbacks as unknown as {
  jwt(args: { token: Token; user?: { accessToken?: string; refreshToken?: string; name?: string; email?: string }; account?: { provider: string; id_token?: string }; trigger?: string; session?: Record<string, unknown> }): Promise<Token>
  session(args: { session: CallbackSession; token: Token }): Promise<CallbackSession>
}

describe('Auth.js identity/session callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.validateSession.mockResolvedValue({ userId: 'verified-user', orgId: 'school', sessionId: 'device', refreshRequestId: '50718cc5-c43f-4d19-9a31-748c2f18ef95' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 'verified-user', name: 'Learner', systemRole: 'MEMBER', roles: [], onboardingCompleted: true } })))
  })
  it('exposes the verified backend user id and clears identity/roles when authentication fails', async () => {
    const session = { expires: '2026-10-14T00:00:00Z', user: { id: 'email-as-id', email: 'old@example.test', name: 'Old Name', roles: ['SUPER_ADMIN'], systemRole: 'SUPER_ADMIN' } }
    const active = await callbacks().session({ session, token: { backendUserId: 'verified-user', accessToken: 'a', roles: [], systemRole: 'MEMBER' } })
    expect(active.user.id).toBe('verified-user')
    const expired = await callbacks().session({ session: active, token: { error: 'RefreshTokenExpired' } })
    expect(expired.accessToken).toBeUndefined()
    expect(expired.user).toMatchObject({ id: '', email: '', name: '', roles: [] })
    expect(expired.user.systemRole).toBeUndefined()
  })
  it('clears a legacy cookie immediately, even if its old access-token timestamp is still valid', async () => {
    const token = await callbacks().jwt({ token: { accessToken: 'legacy-access', refreshToken: 'legacy-refresh', accessTokenExpires: Date.now() + 900000, roles: ['SUPER_ADMIN'], systemRole: 'SUPER_ADMIN' } })
    expect(token).toMatchObject({ accessToken: undefined, refreshToken: undefined, roles: undefined, systemRole: undefined, error: 'RefreshTokenExpired' })
    expect(api.refresh).not.toHaveBeenCalled()
  })
  it('sends only Google provider-issued identity evidence and rejects missing evidence', async () => {
    api.exchangeGoogle.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 })
    const accepted = await callbacks().jwt({ token: {}, user: { email: 'untrusted@example.test', name: 'Caller assertion' }, account: { provider: 'google', id_token: 'verified-provider-evidence' } })
    expect(api.exchangeGoogle).toHaveBeenCalledWith({ idToken: 'verified-provider-evidence' })
    expect(accepted.backendUserId).toBe('verified-user')
    const rejected = await callbacks().jwt({ token: {}, user: { email: 'victim@example.test' }, account: { provider: 'google' } })
    expect(rejected.accessToken).toBeUndefined()
    expect(api.exchangeGoogle).toHaveBeenCalledTimes(1)
  })
  it('rejects a browser-supplied identity swap while allowing same-user verified bootstrap sessions', async () => {
    const current = { backendUserId: 'verified-user', accessToken: 'old-a', refreshToken: 'old-r', refreshRequestId: '50718cc5-c43f-4d19-9a31-748c2f18ef95', accessTokenExpires: Date.now() + 900000 }
    api.validateSession.mockResolvedValueOnce({ userId: 'attacker-user', orgId: 'other', sessionId: 'other' })
    const rejected = await callbacks().jwt({ token: current, trigger: 'update', session: { accessToken: 'attacker-a', refreshToken: 'attacker-r', systemRole: 'SUPER_ADMIN' } })
    expect(rejected.accessToken).toBeUndefined()
    const accepted = await callbacks().jwt({ token: current, trigger: 'update', session: { accessToken: 'bootstrap-a', refreshToken: 'bootstrap-r', systemRole: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] } })
    expect(accepted).toMatchObject({ backendUserId: 'verified-user', accessToken: 'bootstrap-a', systemRole: 'MEMBER', roles: [] })
  })
  it('discards provider name and photo even when the verified application profile is unavailable',async()=>{api.exchangeGoogle.mockResolvedValue({accessToken:'a',refreshToken:'r',expiresIn:900});vi.mocked(globalThis.fetch).mockRejectedValue(new Error('profile unavailable'));const token=await callbacks().jwt({token:{name:'Provider child name',picture:'https://provider.test/child-photo'},user:{name:'Provider child name',email:'learner@example.test'},account:{provider:'google',id_token:'provider-evidence'}});expect(token.name).toBeUndefined();expect(token.picture).toBeUndefined();expect(token.backendUserId).toBe('verified-user')})
  it('retains existing verified application name and avatar instead of provider defaults',async()=>{api.exchangeGoogle.mockResolvedValue({accessToken:'a',refreshToken:'r',expiresIn:900});vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({data:{id:'verified-user',name:'Existing app nickname',avatarUrl:'https://app.test/stored-avatar',roles:[],systemRole:'MEMBER'}})));const token=await callbacks().jwt({token:{name:'Provider name',picture:'https://provider.test/photo'},user:{name:'Provider name',email:'person@example.test'},account:{provider:'google',id_token:'provider-evidence'}});expect(token.name).toBe('Existing app nickname');expect(token.picture).toBe('https://app.test/stored-avatar')})

});
