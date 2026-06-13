import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getAdminLearningMastery, getAdminLearningOverview } from '@/lib/api/admin'
import { AdminLearningMastery } from '@/components/admin/admin-learning/mastery'

export const metadata: Metadata = {
  title: 'Learning Mastery',
  description: 'Concept-by-concept mastery ledger for a learner.',
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdminLearningMasteryPage({ params, searchParams }: PageProps) {
  const [{ id }, query, headers] = await Promise.all([params, searchParams, getAdminHeaders()])

  try {
    const [overview, data] = await Promise.all([
      getAdminLearningOverview(headers, id),
      getAdminLearningMastery(headers, id, query),
    ])
    return <AdminLearningMastery data={data} user={overview.user} authHeaders={headers} />
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) notFound()
    throw error
  }
}
