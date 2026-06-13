import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminHeaders } from '@/lib/api/admin-session'
import { getHealthLlmProvider } from '@/lib/api/admin'
import { AdminHealthProviderView } from '@/components/admin/admin-health-provider-view'

interface PageProps {
  params: Promise<{ provider: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provider } = await params
  return { title: `${decodeURIComponent(provider)} Provider — Admin Health` }
}

export default async function AdminHealthProviderPage({ params }: PageProps) {
  const { provider } = await params
  const providerName = decodeURIComponent(provider)
  const headers = await getAdminHeaders()

  try {
    const initial = await getHealthLlmProvider(headers, providerName)
    return <AdminHealthProviderView provider={providerName} initial={initial} />
  } catch {
    notFound()
  }
}