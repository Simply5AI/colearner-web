import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminLearningOverview, getAdminLearningSessions } from '@/lib/api/admin'
import { AdminLearningSessions } from '@/components/admin/admin-learning/sessions'

export const metadata: Metadata = {
  title: 'Learning Sessions',
  description: 'Recall session history and per-question attempts for a learner.',
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminLearningSessionsPage({ params, searchParams }: PageProps) {
  const [{ id }, query, headers] = await Promise.all([params, searchParams, getAdminHeaders()])

  try {
    const [overview, data] = await Promise.all([
      getAdminLearningOverview(headers, id),
      getAdminLearningSessions(headers, id, query),
    ])
    return <AdminLearningSessions data={data} user={overview.user} authHeaders={headers} />
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) notFound()
    throw error
  }
}
