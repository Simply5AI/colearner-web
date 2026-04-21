import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getDashboardStats, getRecallQueue, getActivity, getStreakCalendar } from '@/lib/api/dashboard'
import { getRoadmaps } from '@/lib/api/roadmap'
import { getProfile } from '@/lib/api/user'
import { getDailyQuest } from '@/lib/api/gamification'
import { getSessionHistory } from '@/lib/api/recall'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { GreetingBanner } from '@/components/dashboard/greeting-banner'
import { StatsRow } from '@/components/dashboard/stats-row'
import { RecallQueueCard } from '@/components/dashboard/recall-queue-card'
import { StreakActivityCard } from '@/components/dashboard/streak-activity-card'
import { DailyQuestWidget } from '@/components/dashboard/daily-quest-widget'
import { RecentSessionsCard } from '@/components/dashboard/recent-sessions-card'
import { StudyPlansSection } from '@/components/dashboard/study-plans-section'
import { EmptyStudyPlanCta } from '@/components/shared/empty-study-plan-cta'
import { auth } from '@/lib/auth/config'
import type { RecallQueueItem, RecallSessionHistoryItem } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Home',
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

  let stats, rawQueue, activity, streak, profile, roadmapsResp, sessionHistory
  let dailyQuest: import('@/lib/api/gamification').DailyQuest | null = null

  try {
    ;[stats, rawQueue, activity, streak, profile, roadmapsResp, dailyQuest, sessionHistory] = await Promise.all([
      getDashboardStats(headers),
      getRecallQueue(headers).catch(() => []),
      getActivity(headers).catch(() => []),
      getStreakCalendar(headers).catch(() => ({ currentStreak: 0, bestStreak: 0, days: [] })),
      session?.accessToken ? getProfile(session.accessToken).catch(() => null) : Promise.resolve(null),
      getRoadmaps(headers).catch(() => ({ roadmaps: [] })),
      getDailyQuest(headers).catch(() => null),
      getSessionHistory(headers).catch(() => []),
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

  const planCount = roadmapsResp?.roadmaps?.length ?? 0
  const sourceCount = queue.length

  return (
    <>
      <TopBar title="Home" subtitle={formatDate()} />
      <div className="space-y-6 p-7">
        <GreetingBanner
          userName={userName}
          stats={stats}
          planCount={planCount}
          sourceCount={sourceCount}
        />

        {planCount ? (
          <StudyPlansSection roadmaps={roadmapsResp!.roadmaps} />
        ) : (
          <EmptyStudyPlanCta variant="home" />
        )}

        <StatsRow stats={stats} />

        <div className="grid gap-4 lg:grid-cols-2">
          <RecallQueueCard items={queue} />
          <RecentSessionsCard sessions={((sessionHistory as RecallSessionHistoryItem[]) ?? []).slice(0, 5)} />
          <StreakActivityCard streak={streak} activity={activity} />
          <DailyQuestWidget quest={dailyQuest} />
        </div>
      </div>
    </>
  )
}
