import type { Metadata } from 'next'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getLlmConsumption } from '@/lib/api/admin'
import { AiConsumptionView } from '@/components/admin/ai-consumption-view'

export const metadata: Metadata = {
  title: 'AI Consumption — Admin',
}

export default async function AdminAiConsumptionPage() {
  const headers = await getAdminHeaders()
  const initial = await getLlmConsumption(headers, '30d', 'agent')
  return <AiConsumptionView initial={initial} />
}
