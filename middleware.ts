export { auth as middleware } from '@/lib/auth/config'

export const config = {
  matcher: [
    '/',
    '/workspaces',
    '/invite',
    '/age',
    '/consent',
    '/family/:path*',
    '/profiles',
    '/learner',
    '/student-invite',
    '/org/:path*',
    '/dashboard/:path*',
    '/recall/:path*',
    '/extract/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    '/teacher/:path*',
    '/login',
    '/signup',
  ],
}
