'use client'

import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { usePodLeaderboard } from '@/lib/hooks/use-pods'

const medals = ['🥇', '🥈', '🥉']

interface PodLeaderboardProps {
  podId: string
}

export function PodLeaderboard({ podId }: PodLeaderboardProps) {
  const { data: entries, isLoading } = usePodLeaderboard(podId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" /> Weekly Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" /> Weekly Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity this week yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" /> Weekly Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry, i) => (
          <div
            key={entry.userId}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2',
              entry.isCurrentUser && 'bg-primary/5 ring-1 ring-primary/20'
            )}
          >
            <span className="w-6 text-center text-sm font-bold">
              {i < 3 ? medals[i] : `#${entry.rank}`}
            </span>
            <span className="flex-1 text-sm font-medium">
              {entry.name}
              {entry.isCurrentUser && (
                <span className="ml-1 text-xs text-muted-foreground">(you)</span>
              )}
            </span>
            <span className="text-sm font-semibold text-primary">
              {entry.weeklyCorrect ?? 'Private'}
            </span>
            {(entry.currentStreak ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground">
                🔥 {entry.currentStreak}d
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
