import type { Session } from 'next-auth'

function isSafeCallbackUrl(callbackUrl: string | null | undefined): callbackUrl is string {
  return !!callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
}

export function resolvePostLoginPath(
  session: Session | null,
  callbackUrl?: string | null,
): string {
  if (isSafeCallbackUrl(callbackUrl)) {
    return callbackUrl
  }

  const systemRole = session?.user?.systemRole
  const roles = session?.user?.roles ?? []

  if (systemRole === 'SUPER_ADMIN') {
    return '/admin/login'
  }

  if (roles.includes('TEACHER')) {
    return '/teacher/dashboard'
  }

  if (session?.user?.onboardingCompleted) {
    return '/dashboard'
  }

  return '/onboarding/profile'
}