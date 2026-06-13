import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'

export default async function RootPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.systemRole === 'SUPER_ADMIN') {
    redirect('/admin/login')
  }

  if (session.user.roles?.includes('TEACHER')) {
    redirect('/teacher/dashboard')
  }

  if (session.user.onboardingCompleted) {
    redirect('/dashboard')
  }

  redirect('/onboarding/profile')
}
