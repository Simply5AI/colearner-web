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
      systemRole?: string
      roles?: string[]
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
  systemRole?: string
  roles?: string[]
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

      if (trigger === 'update' && session) {
        const updateSession = session as {
          onboardingCompleted?: boolean
          accessToken?: string
          refreshToken?: string
        }
        if (updateSession.onboardingCompleted) {
          t.onboardingCompleted = true
        }
        if (updateSession.accessToken) {
          t.accessToken = updateSession.accessToken
          t.accessTokenExpires = Date.now() + 14 * 60 * 1000
          t.roles = undefined
          t.systemRole = undefined
        }
        if (updateSession.refreshToken) {
          t.refreshToken = updateSession.refreshToken
        }
      }

      if (account?.provider === 'google' && user) {
        // Exchange Google profile with backend to get backend JWTs
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL
          const res = await fetch(`${API_URL}/api/auth/google/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              image: user.image,
              googleId: account.providerAccountId,
            }),
          })
          if (res.ok) {
            const json = await res.json()
            const tokens = json.data ?? json
            t.accessToken = tokens.accessToken
            t.refreshToken = tokens.refreshToken
            t.accessTokenExpires = Date.now() + 14 * 60 * 1000
          } else {
            console.error('[auth:jwt] Google token exchange failed:', res.status)
            t.accessToken = undefined
          }
        } catch (err) {
          console.error('[auth:jwt] Google token exchange error:', err)
          t.accessToken = undefined
        }
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

      // Refresh profile claims on sign-in, token refresh, or explicit session update.
      if (t.accessToken && (user || trigger === 'update' || !t.systemRole || !t.roles)) {
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
              profile.onboardingCompleted ||
              profile.onboardingCompletedAt ||
              profile.goals?.length > 0
            )
            if (profile.systemRole === 'SUPER_ADMIN') {
              t.onboardingCompleted = true
            }
            if (profile.roles?.includes('TEACHER')) {
              t.onboardingCompleted = true
            }
            if (profile.displayName || profile.name) {
              t.name = profile.displayName || profile.name
            }
            if (profile.systemRole) {
              t.systemRole = profile.systemRole
            }
            if (Array.isArray(profile.roles)) {
              t.roles = profile.roles
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
        if (t.systemRole) {
          session.user.systemRole = t.systemRole
        }
        if (t.roles) {
          session.user.roles = t.roles
        }
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      // A user is only fully logged in if they have both their profile and at least one valid token
      // Without an access token (e.g., if refresh fails), they should be forced to log in again
      const hasAccessToken = !!(auth as { accessToken?: string })?.accessToken
      const isLoggedIn = !!auth?.user && hasAccessToken

      const isOnboarded = (auth as { user?: { onboardingCompleted?: boolean } })?.user
        ?.onboardingCompleted ?? false
      const isSuperAdmin = (auth as { user?: { systemRole?: string } })?.user
        ?.systemRole === 'SUPER_ADMIN'
      const isTeacher = (auth as { user?: { roles?: string[] } })?.user?.roles?.includes('TEACHER')
      const isOnboardingPage = nextUrl.pathname.startsWith('/onboarding')
      const isBecomeTeacherPage = nextUrl.pathname.startsWith('/become-teacher')
      const isTeacherPage = nextUrl.pathname.startsWith('/teacher')
      const isTeacherSetupPath =
        nextUrl.pathname === '/teacher/org-setup' || isBecomeTeacherPage
      const isProtectedApp =
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/recall') ||
        nextUrl.pathname.startsWith('/extract') ||
        nextUrl.pathname.startsWith('/capture') ||
        nextUrl.pathname.startsWith('/queue') ||
        nextUrl.pathname.startsWith('/progress') ||
        nextUrl.pathname.startsWith('/settings')
      const isAdminPage = nextUrl.pathname.startsWith('/admin')
      const isAdminLoginPage = nextUrl.pathname === '/admin/login'

      // Require auth for onboarding, teacher, become-teacher, and app routes
      if (
        (isProtectedApp ||
          isOnboardingPage ||
          isTeacherPage ||
          isBecomeTeacherPage ||
          (isAdminPage && !isAdminLoginPage)) &&
        !isLoggedIn
      ) {
        const loginUrl = new URL('/login', nextUrl)
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return Response.redirect(loginUrl)
      }

      // Redirect from root based on auth/onboarding status
      if (nextUrl.pathname === '/') {
        if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl))
        if (isSuperAdmin) return Response.redirect(new URL('/admin/login', nextUrl))
        if (isTeacher) return Response.redirect(new URL('/teacher/dashboard', nextUrl))
        const target = isOnboarded ? '/dashboard' : '/onboarding/profile'
        return Response.redirect(new URL(target, nextUrl))
      }

      if ((isProtectedApp || isOnboardingPage) && isLoggedIn && isSuperAdmin) {
        return Response.redirect(new URL('/admin/login', nextUrl))
      }

      if (isTeacherPage && isLoggedIn && !isTeacher && !isTeacherSetupPath) {
        return Response.redirect(new URL('/become-teacher', nextUrl))
      }

      if (
        isTeacherPage &&
        isLoggedIn &&
        !isTeacher &&
        nextUrl.pathname === '/teacher/onboarding'
      ) {
        return Response.redirect(new URL('/teacher/org-setup', nextUrl))
      }

      // Redirect to onboarding if not completed (when accessing student app routes)
      if (isProtectedApp && isLoggedIn && !isOnboarded && !isTeacher) {
        return Response.redirect(new URL('/onboarding/profile', nextUrl))
      }

      // TODO: Re-enable after testing — temporarily allowing access to onboarding pages
      // if (isOnboardingPage && isLoggedIn && isOnboarded) {
      //   if (nextUrl.pathname === '/onboarding/welcome') return true
      //   return Response.redirect(new URL('/dashboard', nextUrl))
      // }

      return true
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
