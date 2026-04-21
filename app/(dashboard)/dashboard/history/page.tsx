import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getSessionHistory } from '@/lib/api/recall'
import { TopBar } from '@/components/shared/TopBar'
import { SessionHistoryList } from '@/components/recall/session-history-list'

export const metadata: Metadata = {
  title: 'Session History',
}

export default async function HistoryPage() {
  const headers = await getAuthHeaders()
  const sessions = await getSessionHistory(headers)

  return (
    <>
      <TopBar
        title="Session History"
        subtitle="Review your past practice sessions and answer sheets"
      />
      <div className="p-7">
        <SessionHistoryList sessions={sessions} />
      </div>
    </>
  )
}
