/**
 * Client-side wrappers for the admin auth BFF (`/api/admin-auth/*`, web origin).
 * These run in the browser and talk only to colearner-web; the route handlers
 * proxy to the API and manage the httpOnly session cookie.
 */

export class AdminAuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AdminAuthError(res.status, json?.message ?? 'Request failed', json?.code)
  }
  return json as T
}

export type AdminLoginStatus = 'TOTP_SETUP_REQUIRED' | 'TOTP_CHALLENGE_REQUIRED'

export function adminLogin(email: string, password: string) {
  return post<{ status: AdminLoginStatus }>('/api/admin-auth/login', { email, password })
}

export function adminTotpSetup() {
  return post<{ otpauthUrl: string; qrDataUrl: string }>('/api/admin-auth/totp-setup')
}

export function adminTotpVerify(code: string) {
  return post<{ backupCodes: string[] }>('/api/admin-auth/totp-verify', { code })
}

export function adminChallenge(code: string) {
  return post<{ status: 'authenticated' }>('/api/admin-auth/challenge', { code })
}

export function adminReauth(code: string) {
  return post<{ status: 'reauth_ok' }>('/api/admin-auth/reauth', { code })
}

export function adminLogout() {
  return post<{ status: 'logged_out' }>('/api/admin-auth/logout')
}

export async function adminMe(): Promise<{ authenticated: boolean; email: string | null }> {
  const res = await fetch('/api/admin-auth/me', { cache: 'no-store' })
  if (!res.ok) return { authenticated: false, email: null }
  return res.json()
}
