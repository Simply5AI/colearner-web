import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getBadges } from '@/lib/api/gamification'
import { getRoadmaps } from '@/lib/api/roadmap'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { BadgeCategorySection } from '@/components/trophies/badge-category-section'
import { EmptyStudyPlanCta } from '@/components/shared/empty-study-plan-cta'
import { GraduationCap, Camera, Brain, Trophy } from 'lucide-react'
import type { Badge as BadgeType } from '@/lib/api/gamification'

export const metadata: Metadata = {
  title: 'Achievements',
}

const CATEGORIES = [
  {
    key: 'study_plan',
    title: 'Study Plan',
    description: 'Plan and complete your learning journey',
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    key: 'capture',
    title: 'Capture',
    description: 'Build your knowledge library',
    icon: <Camera className="h-4 w-4" />,
  },
  {
    key: 'learning',
    title: 'Learning',
    description: 'Master what you capture',
    icon: <Brain className="h-4 w-4" />,
  },
] as const

function groupByCategory(badges: BadgeType[]) {
  const map: Record<string, BadgeType[]> = {}
  for (const b of badges) {
    const cat = b.category || 'other'
    if (!map[cat]) map[cat] = []
    map[cat].push(b)
  }
  return map
}

export default async function TrophiesPage() {
  const headers = await getAuthHeaders()

  let badgesResponse
  let roadmapsResp

  try {
    ;[badgesResponse, roadmapsResp] = await Promise.all([
      getBadges(headers),
      getRoadmaps(headers).catch(() => ({ roadmaps: [] })),
    ])
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    badgesResponse = { earned: [], locked: [] }
    roadmapsResp = { roadmaps: [] }
  }

  const allBadges = [...badgesResponse.earned, ...badgesResponse.locked]
  const byCategory = groupByCategory(allBadges)
  const totalEarned = badgesResponse.earned.length
  const hasRoadmaps = roadmapsResp.roadmaps.length > 0

  return (
    <>
      <TopBar title="Achievements" subtitle="Your lifetime achievements" />
      <div className="mx-auto max-w-6xl space-y-8 p-7">
        <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-6">
          <div className="rounded-full bg-primary/20 p-4">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Achievements</h2>
            <p className="text-sm text-muted-foreground">
              {totalEarned} of {allBadges.length} badges unlocked. Keep learning to collect them all.
            </p>
          </div>
        </div>

        {CATEGORIES.map((cat) => {
          const badges = byCategory[cat.key] ?? []
          const emptyState =
            cat.key === 'study_plan' && !hasRoadmaps ? (
              <EmptyStudyPlanCta variant="achievements" />
            ) : null
          return (
            <BadgeCategorySection
              key={cat.key}
              title={cat.title}
              description={cat.description}
              icon={cat.icon}
              badges={badges}
              emptyState={emptyState}
            />
          )
        })}
      </div>
    </>
  )
}
