import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getDashboardStats, getRecallQueue, getActivity, getSourceProgress, getStreakCalendar } from '@/lib/api/dashboard'
import { getProfile } from '@/lib/api/user'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { GreetingBanner } from '@/components/dashboard/greeting-banner'
import { StatsRow } from '@/components/dashboard/stats-row'
import { NotificationNudge } from '@/components/dashboard/notification-nudge'
import { SourceProgressCard } from '@/components/dashboard/source-progress-card'
import { RecallQueueCard } from '@/components/dashboard/recall-queue-card'
import { QuickCaptureCard } from '@/components/dashboard/quick-capture-card'
import { StreakActivityCard } from '@/components/dashboard/streak-activity-card'
import { auth } from '@/lib/auth/config'
import type { RecallQueueItem } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Dashboard',
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const headers = await getAuthHeaders()
  const session = await auth()

  let stats, rawQueue, activity, sourceProgress, streak, profile

  try {
    ;[stats, rawQueue, activity, sourceProgress, streak, profile] = await Promise.all([
      getDashboardStats(headers),
      getRecallQueue(headers).catch(() => []),
      getActivity(headers).catch(() => []),
      getSourceProgress(headers).catch(() => null),
      getStreakCalendar(headers).catch(() => ({ currentStreak: 0, bestStreak: 0, days: [] })),
      session?.accessToken ? getProfile(session.accessToken).catch(() => null) : Promise.resolve(null),
    ])
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    throw err
  }

  const userName = profile?.name || session?.user?.name || 'User'

  const queue = Array.isArray(rawQueue) 
    ? rawQueue 
    : (rawQueue as { items?: RecallQueueItem[], queue?: RecallQueueItem[] })?.items || (rawQueue as { items?: RecallQueueItem[], queue?: RecallQueueItem[] })?.queue || []

  const dueCount = queue.length
  const failedCount = queue.filter((q: React.ComponentProps<typeof RecallQueueCard>['queue'][0] | RecallQueueItem) => q.source === 'failed').length

  return (
    <>
      <TopBar title="Dashboard" subtitle={formatDate()} />
      <div className="space-y-6 p-7">
        <GreetingBanner
          userName={userName}
          stats={stats}
          dueCount={dueCount}
        />

        <StatsRow stats={stats} />

        <NotificationNudge dueCount={dueCount} failedCount={failedCount} />

        <div className="grid gap-4 lg:grid-cols-2">
          {sourceProgress && (
            <SourceProgressCard progress={sourceProgress} />
          )}
          <RecallQueueCard items={queue} />
          <QuickCaptureCard />
          <StreakActivityCard streak={streak} activity={activity} />
        </div>
      </div>
    </>
  )
}
