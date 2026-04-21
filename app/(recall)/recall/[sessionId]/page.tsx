import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { ApiError } from '@/lib/api/client'
import { RecallSession } from '@/components/recall/recall-session'

export const metadata: Metadata = {
  title: 'Practice Session',
}

export default async function RecallSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  let headers: Record<string, string>
  try {
    headers = await getAuthHeaders()
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    throw err
  }

  return <RecallSession sessionId={sessionId} authHeaders={headers} />
}
