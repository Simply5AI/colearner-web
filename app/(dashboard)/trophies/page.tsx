import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getBadges } from '@/lib/api/gamification'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge as BadgeIcon, LockKeyhole, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/lib/api/gamification'

export const metadata: Metadata = {
  title: 'Trophy Room',
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-700/10 text-amber-700 border-amber-700/20 dark:bg-amber-700/20 dark:text-amber-500 dark:border-amber-700/40',
  SILVER: 'bg-slate-400/10 text-slate-500 border-slate-400/20 dark:bg-slate-400/20 dark:text-slate-300 dark:border-slate-400/40',
  GOLD: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40',
  PLATINUM: 'bg-cyan-400/10 text-cyan-600 border-cyan-400/20 dark:bg-cyan-400/20 dark:text-cyan-300 dark:border-cyan-400/40',
  DIAMOND: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 to-purple-500/10',
}

function BadgeCard({ badge }: { badge: Badge }) {
  const isEarned = badge.isEarned
  const tierColor = isEarned ? TIER_COLORS[badge.tier || 'BRONZE'] : 'bg-muted/30 text-muted-foreground border-border/50 opacity-60 grayscale'

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      tierColor,
      isEarned && "hover:shadow-md hover:-translate-y-1",
      "border"
    )}>
      <CardHeader className="text-center pb-2">
        <div className="mx-auto bg-background/50 rounded-full w-16 h-16 flex items-center justify-center mb-2 shadow-sm border border-border/30 backdrop-blur-sm">
          {isEarned ? (
            <Trophy className={cn(
              "h-8 w-8", 
              badge.tier === 'GOLD' ? 'text-yellow-500' :
              badge.tier === 'PLATINUM' ? 'text-cyan-400' :
              badge.tier === 'DIAMOND' ? 'text-indigo-500' :
              badge.tier === 'SILVER' ? 'text-slate-400' :
              'text-amber-700'
            )} />
          ) : (
            <LockKeyhole className="h-6 w-6 opacity-30" />
          )}
        </div>
        <CardTitle className="text-md font-bold">{badge.name}</CardTitle>
        <CardDescription className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isEarned ? "opacity-90" : "opacity-50"
        )}>
          {badge.tier}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm">
        <p className={isEarned ? "opacity-90" : "opacity-50"}>
          {badge.description}
        </p>
        {isEarned && badge.earnedAt && (
          <p className="text-[10px] mt-4 opacity-60 font-medium">
            Earned {new Date(badge.earnedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default async function TrophiesPage() {
  const headers = await getAuthHeaders()

  let badgesResponse

  try {
    badgesResponse = await getBadges(headers)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    // Fallback if badges not available
    badgesResponse = { earned: [], locked: [] }
  }

  const { earned, locked } = badgesResponse

  return (
    <>
      <TopBar title="Trophy Room" subtitle="Your lifetime achievements" />
      <div className="space-y-8 p-7 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 bg-primary/10 p-6 rounded-2xl border border-primary/20">
          <div className="bg-primary/20 p-4 rounded-full">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Achievements</h2>
            <p className="text-muted-foreground">
              You have unlocked {earned.length} out of {earned.length + locked.length} badges. Keep learning to collect them all!
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BadgeIcon className="h-5 w-5 text-primary" />
            Earned Badges
          </h3>
          {earned.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {earned.map(badge => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
              <p className="text-muted-foreground">You haven't earned any badges yet. Start learning to unlock some!</p>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
            <LockKeyhole className="h-5 w-5" />
            Locked Badges
          </h3>
          {locked.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {locked.map(badge => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
              <p className="text-muted-foreground">You've unlocked every badge! Incredible!</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
