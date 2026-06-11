import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { AdminShell } from '@/components/admin/admin-shell'
import { getAdminMe } from '@/lib/api/admin-session'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.accessToken) {
    redirect('/login')
  }

  if (session.user.systemRole !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  // The admin TOTP session is separate from the consumer Auth.js session. When it
  // is missing/expired, render children bare — the only reachable route in that
  // state is the admin login/TOTP flow, which renders its own full-screen UI.
  // Guarded data pages call requireAdminSession() and redirect to /admin/login.
  const me = await getAdminMe()
  if (!me) {
    return <>{children}</>
  }

  return <AdminShell adminEmail={me.user.email}>{children}</AdminShell>
}
