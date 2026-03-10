import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getQueueStats } from '@/lib/api/recall'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { SessionHero } from '@/components/recall/session-hero'
import { QuestionCountSelector } from '@/components/recall/question-count-selector'
import { QueuePreview } from '@/components/recall/queue-preview'

export const metadata: Metadata = {
  title: 'Start Recall Session',
}

export default async function RecallStartPage() {
  const headers = await getAuthHeaders()

  let stats
  try {
    stats = await getQueueStats(headers)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    throw err
  }

  return (
    <>
      <TopBar title="Recall" />
      <div className="space-y-6">
        <SessionHero stats={stats} />
        <QuestionCountSelector stats={stats} authHeaders={headers} />
        <QueuePreview stats={stats} />
      </div>
    </>
  )
}
