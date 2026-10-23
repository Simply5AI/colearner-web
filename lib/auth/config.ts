import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'
import { CredentialsSignin } from 'next-auth'
import { loginUser } from '@/lib/api/auth'
import { platformApiBaseUrl, platformClient } from '@/lib/api/platform-client'
import { acceptSessionPair, clearSession, refreshSession } from './session-tokens'
import { getGoogleProviderConfiguration } from './google-provider.server'
import {googleIdentityOnly} from './google-identity'

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
    expiresIn?: number
    refreshRequestId?: string
  }
}

// Extend JWT token type
interface ExtendedJWT {
  [key: string]: unknown
  accessToken?: string
  refreshToken?: string
  refreshRequestId?: string
  backendUserId?: string
  accessTokenExpires?: number
  onboardingCompleted?: boolean
  systemRole?: string
  roles?: string[]
  error?: string
}

async function refreshAccessToken(t: ExtendedJWT): Promise<ExtendedJWT> {
  return refreshSession(t)
}

const googleProvider = getGoogleProviderConfiguration()
class LoginRateLimited extends CredentialsSignin {
  // The code reaches the browser as a plain string: "rate_limited" or "rate_limited:<minutes>".
  constructor(minutes?: number) { super(); this.code = minutes ? `rate_limited:${minutes}` : 'rate_limited' }
}

const authConfig: NextAuthConfig = {
  providers: [
    ...(googleProvider ? [Google({...googleProvider,authorization:{params:{scope:'openid email'}},profile:googleIdentityOnly})] : []),
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

          if (!tokens.accessToken || !tokens.refreshToken || !Number.isFinite(tokens.expiresIn) || tokens.expiresIn <= 0) {
            console.error('[auth] Login did not establish a session')
            return null
          }

          return {
            id: credentials.email as string,
            email: credentials.email as string,
            name: '',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            refreshRequestId: tokens.refreshRequestId,
          }
        } catch (error) {
          console.error('[auth] Sign-in failed')
          // A throttled login is reported as such (the form shows a clear message) instead of as a wrong password.
          if ((error as { status?: number } | null)?.status === 429) {
            const seconds = (error as { retryAfterSeconds?: number }).retryAfterSeconds
            throw new LoginRateLimited(seconds ? Math.max(1, Math.ceil(seconds / 60)) : undefined)
          }
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      let t = token as ExtendedJWT

      // Pre-foundation cookies carry unscoped credentials and unverified role
      // metadata. Invalidate immediately instead of showing a logged-in shell
      // until their old access-token timestamp happens to expire.
      if (!user && !account && (!t.backendUserId || !t.refreshRequestId || !Number.isFinite(t.accessTokenExpires))) return clearSession(t)

      if (trigger === 'update' && session) {
        const updateSession = session as {
          onboardingCompleted?: boolean
          accessToken?: string
          refreshToken?: string
        }
        // Client session updates are untrusted. Bootstrap may supply a new org
        // session, but both credentials must be validated by the backend and
        // remain bound to the current backend user.
        if (updateSession.accessToken || updateSession.refreshToken) {
          if (!t.backendUserId || !updateSession.accessToken || !updateSession.refreshToken) return clearSession(t)
          try {
            t = await acceptSessionPair(t, { accessToken: updateSession.accessToken, refreshToken: updateSession.refreshToken })
            t.roles = undefined
            t.systemRole = undefined
          } catch { return clearSession(t) }
        }
      }

      if (account?.provider === 'google' && user) {
        // Discard Auth.js provider defaults before consulting the verified app profile.
        delete t.name
        delete t.picture
        // Auth.js verifies OIDC state/nonce. Nest independently verifies Google's
        // ID-token signature and identity claims before issuing product tokens.
        try {
          if (!account.id_token) throw new Error('Missing provider identity evidence')
          t = await acceptSessionPair(t, await platformClient().exchangeGoogle({ idToken: account.id_token }))
        } catch {
          console.error('[auth] Google sign-in failed')
          return clearSession(t)
        }
      }
      if (user) {
        if (user.accessToken && user.refreshToken) {
          try { t = await acceptSessionPair(t, {
            accessToken: user.accessToken, refreshToken: user.refreshToken,
            ...(typeof user.expiresIn === 'number' && Number.isFinite(user.expiresIn) && user.expiresIn > 0 ? { expiresIn: user.expiresIn, refreshRequestId: user.refreshRequestId } : {}),
          }) }
          catch { return clearSession(t) }
        }
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
        t = refreshed
      }

      // Refresh profile claims on sign-in, token refresh, or explicit session update.
      if (t.accessToken && (user || trigger === 'update' || !t.systemRole || !t.roles)) {
        try {
          const res = await fetch(`${platformApiBaseUrl()}/users/me`, {
            headers: { Authorization: `Bearer ${t.accessToken}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) {
            const json = await res.json()
            // Backend wraps responses in { statusCode, data, timestamp } envelope
            const profile = json.data ?? json
            if (profile.id !== t.backendUserId) return clearSession(t)
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
            t.picture=typeof profile.avatarUrl==='string'?profile.avatarUrl:undefined
            t.systemRole = typeof profile.systemRole === 'string' ? profile.systemRole : undefined
            t.roles = Array.isArray(profile.roles) ? profile.roles.filter((role: unknown) => typeof role === 'string') : []
          } else {
            if (res.status === 401 || res.status === 403) return clearSession(t)
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
        session.user = { id: '', email: '', name: '', emailVerified: null, onboardingCompleted: false, roles: [] }
        return session
      }

      session.accessToken = t.accessToken
      if (session.user) {
        session.user.image=typeof t.picture==='string'?t.picture:undefined
        session.user.id = t.backendUserId ?? ''
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
      const isSchoolPage = nextUrl.pathname === '/family' || nextUrl.pathname === '/workspaces' || nextUrl.pathname === '/invite' || nextUrl.pathname.startsWith('/org/')
      // B07 Meet Co admits an opaque child cookie that has no Auth.js session; its
      // own server layout enforces the child/account gate, so only the login redirect is skipped.
      const isMeetCoPage = nextUrl.pathname === '/onboarding/meet-co'
      const isTeacherPage = nextUrl.pathname.startsWith('/teacher')
      const isTeacherPublicPath = nextUrl.pathname === '/teacher/signup'
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

      // Require auth for onboarding, teacher workspace, and app routes
      if (
        (isProtectedApp ||
          isSchoolPage ||
          (isOnboardingPage && !isMeetCoPage) ||
          (isTeacherPage && !isTeacherPublicPath) ||
          (isAdminPage && !isAdminLoginPage)) &&
        !isLoggedIn
      ) {
        const loginUrl = new URL('/login', nextUrl)
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return Response.redirect(loginUrl)
      }

      // Redirect from root based on auth/onboarding status
      if (nextUrl.pathname === '/') {
        // The server page performs live school membership lookup before falling
        // back to legacy personal routes. Middleware still persists refreshes.
        return true
      }

      if ((isProtectedApp || isOnboardingPage) && isLoggedIn && isSuperAdmin) {
        return Response.redirect(new URL('/admin/login', nextUrl))
      }

      // This route now explains bound school entry; an authenticated personal
      // account must not be redirected into an unrelated learning workspace.
      if (isTeacherPublicPath) return true

      // Non-teachers are not bounced to the student app here: the teacher layout verifies the school workspace live and sends
      // anyone without a teacher workspace to /workspaces?denied=1, which explains the denial instead of an unrelated age check.

      // Teachers use the teacher workspace only — not the student learning app.
      if (isProtectedApp && isLoggedIn && isTeacher) {
        return Response.redirect(new URL('/teacher/dashboard', nextUrl))
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
  events: {
    async signOut(message) {
      // Auth.js sign-out revokes backend sessions as well as its web cookie.
      if ('token' in message && message.token?.accessToken) {
        try {
          let token = message.token as ExtendedJWT
          if (token.accessTokenExpires && Date.now() >= token.accessTokenExpires) token = await refreshAccessToken(token)
          if (!token.accessToken) throw new Error('No active backend session')
          const response = await fetch(`${platformApiBaseUrl()}/auth/logout`, {
            method: 'POST', headers: { Authorization: `Bearer ${token.accessToken}` }, signal: AbortSignal.timeout(10000),
          })
          if (!response.ok) throw new Error('Backend session revocation failed')
        } catch { console.error('[auth] Backend sign-out could not be completed') }
      }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
