import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getAdminUser } from '@/lib/api/admin'
import { AdminUserDetailView } from '@/components/admin/admin-user-detail-view'

export const metadata: Metadata = {
  title: 'Admin User Detail',
}

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const [{ id }, headers, session] = await Promise.all([params, getAuthHeaders(), auth()])

  let detail
  try {
    detail = await getAdminUser(headers, id)
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      notFound()
    }
    throw error
  }

  return <AdminUserDetailView detail={detail} currentAdminId={session?.user?.id ?? ''} />
}
