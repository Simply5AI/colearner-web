import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getLlmConsumption } from '@/lib/api/admin'
import { AiConsumptionView } from '@/components/admin/ai-consumption-view'

export const metadata: Metadata = {
  title: 'AI Consumption — Admin',
}

export default async function AdminAiConsumptionPage() {
  const headers = await getAuthHeaders()
  const initial = await getLlmConsumption(headers, '30d', 'agent')
  return <AiConsumptionView initial={initial} />
}
