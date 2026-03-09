import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'
import { loginUser } from '@/lib/api/auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    user: {
      id: string
      email: string
      name: string
      image?: string
      onboardingCompleted?: boolean
    }
  }

  interface User {
    accessToken?: string
    refreshToken?: string
  }
}

// Extend JWT token type
interface ExtendedJWT {
  [key: string]: unknown
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  onboardingCompleted?: boolean
  error?: string
}

async function refreshAccessToken(t: ExtendedJWT): Promise<ExtendedJWT> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: t.refreshToken }),
    })

    if (!res.ok) {
      return { ...t, error: 'RefreshTokenExpired' }
    }

    const json = await res.json()
    const tokens = json.data ?? json

    return {
      ...t,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? t.refreshToken,
      // 14 min — refresh before the 15 min server-side expiry
      accessTokenExpires: Date.now() + 14 * 60 * 1000,
      error: undefined,
    }
  } catch {
    return { ...t, error: 'RefreshTokenExpired' }
  }
}

const authConfig: NextAuthConfig = {
  providers: [
    Google,
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const tokens = await loginUser({
            email: credentials.email as string,
            password: credentials.password as string,
            rememberMe: credentials.rememberMe === 'true',
          })

          if (!tokens.accessToken) {
            console.error('[auth] loginUser returned no accessToken:', JSON.stringify(tokens))
            return null
          }

          return {
            id: credentials.email as string,
            email: credentials.email as string,
            name: '',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          }
        } catch (err) {
          console.error('[auth] authorize failed:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      const t = token as ExtendedJWT

      if (trigger === 'update' && session?.onboardingCompleted) {
        t.onboardingCompleted = true
      }

      if (account?.provider === 'google') {
        t.accessToken = account.access_token as string
        t.accessTokenExpires = Date.now() + 14 * 60 * 1000
      }
      if (user) {
        if (user.accessToken) {
          t.accessToken = user.accessToken
          t.accessTokenExpires = Date.now() + 14 * 60 * 1000
        }
        if (user.refreshToken) t.refreshToken = user.refreshToken
      }

      // Refresh the access token if it has expired (or if accessTokenExpires
      // was never set — e.g. sessions created before this logic was added)
      const tokenExpired = t.accessTokenExpires
        ? Date.now() > t.accessTokenExpires
        : false
      const tokenMissing = !t.accessToken && !!t.refreshToken

      if (!user && trigger !== 'update' && (tokenExpired || tokenMissing) && t.refreshToken) {
        const refreshed = await refreshAccessToken(t)
        if (refreshed.error) {
          // Refresh failed — clear tokens so middleware sees isLoggedIn=false
          return { ...refreshed, accessToken: undefined, refreshToken: undefined }
        }
        return refreshed
      }

      // Check onboarding status on initial sign-in or when session is updated
      if ((user || trigger === 'update') && t.accessToken && !session?.onboardingCompleted) {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL
          const res = await fetch(`${API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${t.accessToken}` },
            cache: 'no-store',
          })
          if (res.ok) {
            const json = await res.json()
            // Backend wraps responses in { statusCode, data, timestamp } envelope
            const profile = json.data ?? json
            console.log('[auth:jwt] /api/users/me raw json keys:', Object.keys(json))
            console.log('[auth:jwt] profile keys:', Object.keys(profile))
            console.log('[auth:jwt] profile.goals:', profile.goals)
            console.log('[auth:jwt] profile.onboardingCompletedAt:', profile.onboardingCompletedAt)
            t.onboardingCompleted = !!(
              profile.goals?.length > 0 || profile.onboardingCompletedAt
            )
            if (profile.displayName || profile.name) {
              t.name = profile.displayName || profile.name
            }
            console.log('[auth:jwt] resolved onboardingCompleted:', t.onboardingCompleted)
          } else {
            console.log('[auth:jwt] /api/users/me returned:', res.status)
            // New user — profile may not exist yet
            t.onboardingCompleted = false
          }
        } catch {
          t.onboardingCompleted = false
        }
      }

      return t
    },
    async session({ session, token }) {
      const t = token as ExtendedJWT

      // If refresh failed, return a session without accessToken
      // so the client knows to redirect to login
      if (t.error === 'RefreshTokenExpired') {
        session.accessToken = undefined
        return session
      }

      session.accessToken = t.accessToken
      if (session.user) {
        session.user.onboardingCompleted = t.onboardingCompleted ?? false
        if (t.name) {
          session.user.name = t.name as string
        }
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnboarded = (auth as { user?: { onboardingCompleted?: boolean } })?.user
        ?.onboardingCompleted ?? false
      const isOnboardingPage = nextUrl.pathname.startsWith('/onboarding')
      const isProtectedApp =
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/recall') ||
        nextUrl.pathname.startsWith('/extract') ||
        nextUrl.pathname.startsWith('/capture') ||
        nextUrl.pathname.startsWith('/queue') ||
        nextUrl.pathname.startsWith('/mastery') ||
        nextUrl.pathname.startsWith('/settings')

      // Require auth for onboarding and app routes
      if ((isProtectedApp || isOnboardingPage) && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl))
      }

      // Redirect from root based on auth/onboarding status
      if (nextUrl.pathname === '/') {
        if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl))
        const target = isOnboarded ? '/dashboard' : '/onboarding/profile'
        return Response.redirect(new URL(target, nextUrl))
      }

      // Redirect logged-in users away from auth pages
      const isAuthPage =
        nextUrl.pathname.startsWith('/login') ||
        nextUrl.pathname.startsWith('/signup')
      if (isAuthPage && isLoggedIn) {
        const target = isOnboarded ? '/dashboard' : '/onboarding/profile'
        return Response.redirect(new URL(target, nextUrl))
      }

      // Redirect to onboarding if not completed (when accessing app routes)
      if (isProtectedApp && isLoggedIn && !isOnboarded) {
        return Response.redirect(new URL('/onboarding/profile', nextUrl))
      }

      // Redirect away from onboarding if already completed (except welcome page)
      if (isOnboardingPage && isLoggedIn && isOnboarded) {
        if (nextUrl.pathname === '/onboarding/welcome') return true
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      return true
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
