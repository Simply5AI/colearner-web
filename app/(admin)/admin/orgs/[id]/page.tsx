import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminOrg, getAdminOrgMembers } from '@/lib/api/admin'
import { AdminOrgDetailView } from '@/components/admin/admin-org-detail-view'

export const metadata: Metadata = {
  title: 'Admin Organization Detail',
}

type AdminOrgDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminOrgDetailPage({ params }: AdminOrgDetailPageProps) {
  const [{ id }, headers] = await Promise.all([params, getAdminHeaders()])

  let detail
  let members
  try {
    ;[detail, members] = await Promise.all([
      getAdminOrg(headers, id),
      getAdminOrgMembers(headers, id, { limit: 100 }),
    ])
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      notFound()
    }
    throw error
  }

  return <AdminOrgDetailView detail={detail} initialMembers={members} />
}
