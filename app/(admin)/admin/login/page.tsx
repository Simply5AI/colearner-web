import type { Metadata } from 'next'
import { AdminLoginFlow } from '@/components/admin/admin-auth/admin-login-flow'

export const metadata: Metadata = {
  title: 'Admin Sign In',
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <AdminLoginFlow />
    </div>
  )
}
