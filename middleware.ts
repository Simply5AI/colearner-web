export { auth as middleware } from '@/lib/auth/config'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/recall/:path*',
    '/extract/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    '/teacher/:path*',
    '/become-teacher',
    '/login',
    '/signup',
  ],
}
