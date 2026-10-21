import type { AuthTokens } from '@colearner/api-client'
import { platformClient } from '@/lib/api/platform-client'

export interface BackendSessionTokens {
  [key: string]: unknown
  accessToken?: string
  refreshToken?: string
  refreshRequestId?: string
  accessTokenExpires?: number
  backendUserId?: string
  error?: string
}

function lifetime(expiresIn: number) { return Date.now() + Math.max(1, expiresIn - Math.min(60, expiresIn / 10)) * 1000 }

export async function acceptSessionPair<T extends BackendSessionTokens>(t: T, pair: AuthTokens | { accessToken: string; refreshToken: string }): Promise<T> {
  const identity = await platformClient().validateSession(pair.accessToken, pair.refreshToken)
  if (t.backendUserId && identity.userId !== t.backendUserId) throw new Error('Session identity change rejected')
  if (!('expiresIn' in pair)) {
    // Session updates (e.g. teacher bootstrap) do not include an expiry. Refresh
    // shortly afterwards using the server's actual expiresIn rather than decoding
    // untrusted browser JWT claims as authority.
    return { ...t, ...pair, backendUserId: identity.userId, refreshRequestId: identity.refreshRequestId ?? crypto.randomUUID(), accessTokenExpires: Date.now() + 60000, error: undefined }
  }
  return { ...t, ...pair, backendUserId: identity.userId, refreshRequestId: identity.refreshRequestId ?? crypto.randomUUID(), accessTokenExpires: lifetime(pair.expiresIn), error: undefined }
}

const inFlight = new Map<string, Promise<AuthTokens>>()

export async function refreshSession<T extends BackendSessionTokens>(t: T): Promise<T> {
  if (!t.refreshToken || !t.refreshRequestId || !t.backendUserId) return clearSession(t)
  try {
    // Same encrypted Auth.js cookie carries the same private operation id across
    // tabs, server renders and instances. Backend atomically deduplicates it for
    // 10 seconds; this process-level single-flight is only an optimisation.
    const key = t.refreshRequestId
    let pending = inFlight.get(key)
    if (!pending) {
      pending = platformClient().refresh({ refreshToken: t.refreshToken, requestId: t.refreshRequestId })
      inFlight.set(key, pending)
    }
    try { return await acceptSessionPair(t, await pending) } finally { if (inFlight.get(key) === pending) inFlight.delete(key) }
  } catch { return clearSession(t) }
}

export function clearSession<T extends BackendSessionTokens>(t: T): T {
  return { ...t, accessToken: undefined, refreshToken: undefined, refreshRequestId: undefined,
    accessTokenExpires: undefined, backendUserId: undefined, roles: undefined, systemRole: undefined,
    onboardingCompleted: undefined, sub: undefined, name: undefined, email: undefined, picture: undefined, error: 'RefreshTokenExpired' }
}
