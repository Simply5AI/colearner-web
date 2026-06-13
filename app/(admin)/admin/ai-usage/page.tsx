import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getLlmConsumption } from '@/lib/api/admin'
import { AiConsumptionView } from '@/components/admin/ai-consumption-view'

export const metadata: Metadata = {
  title: 'AI Usage — Admin',
}

export default async function AdminAiUsagePage() {
  const headers = await getAdminHeaders()
  const initial = await getLlmConsumption(headers, { range: '30d', granularity: 'day' }, 'agent')
  return <AiConsumptionView initial={initial} />
}