import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getHealthOverview } from '@/lib/api/admin'
import { AdminSystemHealthView } from '@/components/admin/admin-system-health-view'

export const metadata: Metadata = {
  title: 'System Health — Admin',
}

export default async function AdminHealthPage() {
  const headers = await getAdminHeaders()
  const initial = await getHealthOverview(headers)
  return <AdminSystemHealthView initial={initial} />
}