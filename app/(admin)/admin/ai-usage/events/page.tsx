import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getLlmConsumptionEvents } from '@/lib/api/admin'
import { AiConsumptionEventsView } from '@/components/admin/ai-consumption-events-view'

export const metadata: Metadata = {
  title: 'AI Usage Events — Admin',
}

export default async function AdminAiUsageEventsPage() {
  const headers = await getAdminHeaders()
  const initial = await getLlmConsumptionEvents(headers, { range: '30d', page: 1, pageSize: 50 })
  return <AiConsumptionEventsView initial={initial} />
}