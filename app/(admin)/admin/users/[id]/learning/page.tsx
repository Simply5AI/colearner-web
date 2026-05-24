import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getAdminLearningOverview } from '@/lib/api/admin'
import { AdminLearningOverview } from '@/components/admin/admin-learning/overview'

export const metadata: Metadata = {
  title: 'Admin User Learning',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminLearningOverviewPage({ params }: PageProps) {
  const [{ id }, headers] = await Promise.all([params, getAuthHeaders()])

  try {
    const data = await getAdminLearningOverview(headers, id)
    return <AdminLearningOverview data={data} />
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) notFound()
    throw error
  }
}
