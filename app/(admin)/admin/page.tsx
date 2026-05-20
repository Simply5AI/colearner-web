import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getAdminDashboardData } from '@/lib/api/admin'
import { AdminDashboardView } from '@/components/admin/admin-dashboard-view'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
}

export default async function AdminDashboardPage() {
  const headers = await getAuthHeaders()
  const data = await getAdminDashboardData(headers)

  return <AdminDashboardView data={data} />
}
