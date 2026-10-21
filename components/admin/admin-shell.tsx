'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { adminLogout } from '@/lib/api/admin-auth-client'
import { AdminIdleGuard } from '@/components/admin/admin-auth/admin-idle-guard'
import { AdminReauthProvider } from '@/components/admin/admin-auth/admin-reauth-provider'
import { RoleShell } from '@/components/roles/role-shell'
import { platformNavigation } from '@/components/roles/role-config'

interface AdminShellProps {
  children: React.ReactNode
  adminEmail?: string | null
}

export function AdminShell({ children, adminEmail }: AdminShellProps) {
  const router = useRouter()
  const signOut = async () => {
    await adminLogout().catch(() => undefined)
    router.replace('/admin/login')
  }
  return <AdminReauthProvider>
    <RoleShell role="platform-admin" navigation={platformNavigation} homeHref="/admin" identity={adminEmail}
      accountActions={<button type="button" onClick={() => void signOut()} aria-label="Sign out" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><LogOut aria-hidden="true" className="size-5" /></button>}
    >{children}</RoleShell>
    <AdminIdleGuard />
  </AdminReauthProvider>
}
