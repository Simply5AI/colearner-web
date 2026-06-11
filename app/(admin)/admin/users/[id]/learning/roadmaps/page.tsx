import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminLearningOverview, getAdminLearningRoadmaps } from '@/lib/api/admin'
import { AdminLearningRoadmaps } from '@/components/admin/admin-learning/roadmaps'

export const metadata: Metadata = {
  title: 'Admin User Learning Roadmaps',
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminLearningRoadmapsPage({ params, searchParams }: PageProps) {
  const [{ id }, query, headers] = await Promise.all([params, searchParams, getAdminHeaders()])

  try {
    const [overview, data] = await Promise.all([
      getAdminLearningOverview(headers, id),
      getAdminLearningRoadmaps(headers, id, query),
    ])
    return <AdminLearningRoadmaps data={data} user={overview.user} authHeaders={headers} />
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) notFound()
    throw error
  }
}
