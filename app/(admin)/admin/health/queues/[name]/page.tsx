import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getHealthQueue, getHealthQueueFailedJobs } from '@/lib/api/admin'
import { AdminHealthQueueView } from '@/components/admin/admin-health-queue-view'

interface PageProps {
  params: Promise<{ name: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params
  return { title: `${decodeURIComponent(name)} Queue — Admin Health` }
}

export default async function AdminHealthQueuePage({ params }: PageProps) {
  const { name } = await params
  const queueName = decodeURIComponent(name)
  const headers = await getAdminHeaders()

  try {
    const [initialQueue, initialFailed] = await Promise.all([
      getHealthQueue(headers, queueName),
      getHealthQueueFailedJobs(headers, queueName, 1, 20),
    ])

    return (
      <AdminHealthQueueView
        queueName={queueName}
        initialQueue={initialQueue}
        initialFailed={initialFailed}
      />
    )
  } catch {
    notFound()
  }
}