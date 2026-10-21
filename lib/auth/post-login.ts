import type { Session } from 'next-auth'

export function isSafeCallbackUrl(callbackUrl: string | null | undefined): callbackUrl is string {
  if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) return false
  // WHATWG URL parsing treats backslashes as slashes and strips ASCII controls.
  // Reject those before normalization so browser navigation cannot turn a path
  // into a protocol-relative external URL.
  if (/[\\\u0000-\u001f\u007f]/.test(callbackUrl)) return false
  try {
    const origin = 'https://colearner-callback.invalid'
    return new URL(callbackUrl, origin).origin === origin
  } catch { return false }
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
