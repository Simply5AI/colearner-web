// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { getGoogleProviderConfiguration } from '@/lib/auth/google-provider.server'
describe('server-only complete Google configuration', () => {
  it('prefers a complete Auth.js pair', () => { expect(getGoogleProviderConfiguration({ AUTH_GOOGLE_ID: 'auth-id', AUTH_GOOGLE_SECRET: 'test-auth-secret', GOOGLE_CLIENT_ID: 'legacy-id', GOOGLE_CLIENT_SECRET: 'test-legacy-secret' })).toEqual({ clientId: 'auth-id', clientSecret: 'test-auth-secret' }) })
  it('uses a complete legacy pair when Auth.js configuration is incomplete', () => { expect(getGoogleProviderConfiguration({ AUTH_GOOGLE_ID: 'incomplete', GOOGLE_CLIENT_ID: 'legacy-id', GOOGLE_CLIENT_SECRET: 'test-legacy-secret' })).toEqual({ clientId: 'legacy-id', clientSecret: 'test-legacy-secret' }) })
  it.each([{}, { AUTH_GOOGLE_ID: 'one-side' }, { GOOGLE_CLIENT_SECRET: 'one-side' }, { AUTH_GOOGLE_ID: 'one-side', GOOGLE_CLIENT_SECRET: 'other-side' }, { GOOGLE_CLIENT_ID: 'one-side', AUTH_GOOGLE_SECRET: 'other-side' }])('does not mix incomplete configuration', (environment) => { expect(getGoogleProviderConfiguration(environment)).toBeUndefined() })
  it('rejects accidental browser invocation without returning configuration', () => {
    vi.stubGlobal('window', {})
    try { expect(() => getGoogleProviderConfiguration({})).toThrow('server-only') }
    finally { vi.unstubAllGlobals() }
  })
})
