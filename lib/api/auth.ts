import { apiClient, ApiError } from '@/lib/api/client'

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface RegisterPayload {
  name: string
  email: string
  password: string
  acceptedTerms?: boolean
}

interface LoginPayload {
  email: string
  password: string
  rememberMe?: boolean
}

/**
 * Register a new user.
 * Uses a same-origin proxy route (/api/auth/register/route.ts)
 * to avoid NextAuth's [...nextauth] catch-all intercepting the request.
 */
export async function registerUser(payload: RegisterPayload): Promise<AuthTokens> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message)
  }

  return res.json()
}

/**
 * Login is called server-side from NextAuth's authorize callback,
 * so it uses apiClient which resolves NEXT_PUBLIC_API_URL server-side.
 */
export async function loginUser(payload: LoginPayload): Promise<AuthTokens> {
  return apiClient<AuthTokens>('/api/auth/login', {
    method: 'POST',
    body: payload,
  })
}

/**
 * Forgot password — uses same-origin proxy route to avoid NextAuth catch-all.
 */
export async function forgotPassword(email: string): Promise<void> {
  const apiUrl = getApiUrl()
  const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message)
  }
}
function getApiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[apiClient] NEXT_PUBLIC_API_URL is not set. Falling back to http://localhost:3000. ' +
        'Restart the dev server if you just added it to .env.'
      )
    }
    return 'http://localhost:3000'
  }
  return url
}

