import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiClient, ApiError } from '@/lib/api/client'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie'

export interface AdminMe {
  user: {
    id: string
    email: string
    name: string | null
    systemRole: string
    avatarUrl: string | null
    adminTotpSecret: { verifiedAt: string | null; createdAt: string } | null
  }
  session: {
    createdAt: number
    lastSeenAt: number
    reauthedAt: number | null
  }
}

/**
 * Build the headers that forward the admin session to the API for server-side
 * (server component / route handler) calls. Returns an empty object when no
 * admin session cookie is present on the web origin.
 */
export async function getAdminCookieHeader(): Promise<Record<string, string>> {
  const store = await cookies()
  const sid = store.get(ADMIN_SESSION_COOKIE)?.value
  return sid ? { Cookie: `${ADMIN_SESSION_COOKIE}=${sid}` } : {}
}

/** Resolve the current admin session, or `null` if missing/expired/invalid. */
export async function getAdminMe(): Promise<AdminMe | null> {
  const headers = await getAdminCookieHeader()
  if (!headers.Cookie) return null
  try {
    return await apiClient<AdminMe>('/api/admin/auth/me', { headers })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/**
 * Guard helper for admin server components: ensures a valid admin session and
 * returns the forwarding headers + the resolved admin identity. Redirects to the
 * admin login when the session is missing or expired.
 */
export async function requireAdminSession(): Promise<{
  headers: Record<string, string>
  me: AdminMe
}> {
  const me = await getAdminMe()
  if (!me) redirect('/admin/login')
  return { headers: await getAdminCookieHeader(), me }
}

/**
 * Drop-in replacement for `getAuthHeaders()` on admin pages: validates the admin
 * session (redirecting to `/admin/login` when absent/expired) and returns the
 * cookie-forwarding headers to pass to the admin API client.
 */
export async function getAdminHeaders(): Promise<Record<string, string>> {
  const { headers } = await requireAdminSession()
  return headers
}
