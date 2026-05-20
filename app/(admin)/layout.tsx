import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { AdminShell } from '@/components/admin/admin-shell'

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

  return <AdminShell adminEmail={session.user.email}>{children}</AdminShell>
}
