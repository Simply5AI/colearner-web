'use client'

import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getRecallQueue } from '@/lib/api/dashboard'
import { QueueFilters } from '@/components/dashboard/queue-filters'
import { QueueTable } from '@/components/dashboard/queue-table'

export function QueueTab() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()

  const typeFilter = searchParams.get('type') || undefined
  const failedFilter = searchParams.get('failed') === 'true' || undefined

  const { data: items, isLoading } = useQuery({
    queryKey: ['recallQueue', { type: typeFilter, failed: failedFilter }],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      return getRecallQueue(headers, {
        type: typeFilter,
        failed: failedFilter,
      })
    },
    enabled: !!session?.accessToken,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading review queue...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <QueueFilters />
      <QueueTable items={items ?? []} />
    </div>
  )
}
