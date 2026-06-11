import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminDashboardData } from '@/lib/api/admin'
import { AdminDashboardView } from '@/components/admin/admin-dashboard-view'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
}

export default async function AdminDashboardPage() {
  const headers = await getAdminHeaders()
  const data = await getAdminDashboardData(headers)

  return <AdminDashboardView data={data} />
}
