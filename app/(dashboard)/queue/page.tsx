import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getRecallQueue } from '@/lib/api/dashboard'
import { TopBar } from '@/components/shared/TopBar'
import { QueueFilters } from '@/components/dashboard/queue-filters'
import { QueueTable } from '@/components/dashboard/queue-table'

export const metadata: Metadata = {
  title: 'Review Queue',
}

interface QueuePageProps {
  searchParams: Promise<{ type?: string; failed?: string }>
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const params = await searchParams
  const headers = await getAuthHeaders()

  const items = await getRecallQueue(headers, {
    type: params.type || undefined,
    failed: params.failed === 'true' || undefined,
  })

  return (
    <>
      <TopBar title="Review Queue" subtitle={`${items.length} items`}>
        <Link
          href="/recall"
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90"
        >
          Start All →
        </Link>
      </TopBar>
      <div className="space-y-4 p-7">
        <QueueFilters />
        <QueueTable items={items} />
      </div>
    </>
  )
}
