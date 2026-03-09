'use client'

import { cn } from '@/lib/utils'
import type { StreakCalendar, ActivityItem } from '@/lib/types'

interface StreakActivityCardProps {
  streak: StreakCalendar
  activity: ActivityItem[]
}

const activityDotColor: Record<string, string> = {
  recall_pass: 'bg-green-600',
  recall_fail: 'bg-destructive',
  capture: 'bg-primary',
  state_change: 'bg-blue-600',
  milestone: 'bg-purple-600',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export function StreakActivityCard({
  streak,
  activity,
}: StreakActivityCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border/50 px-[18px] py-3.5">
        <div className="text-[13px] font-bold text-foreground">
          🔥 Weekly Streak
        </div>
      </div>

      <div className="p-[18px]">
        {/* Streak days row */}
        <div className="mb-2 flex gap-1">
          {(streak?.days || []).map((day) => (
            <div
              key={day.date}
              className={cn(
                'flex h-7 flex-1 items-center justify-center rounded text-[9px] font-bold',
                day.status === 'active' &&
                  'border border-green-600 bg-green-50 text-green-600',
                day.status === 'missed' &&
                  'border border-destructive/20 bg-destructive/5 text-destructive',
                day.status === 'today' &&
                  'border-2 border-primary bg-primary/10 text-primary',
                day.status === 'future' &&
                  'border border-border/50 bg-accent/50 text-muted-foreground'
              )}
            >
              {day.dayLabel}
            </div>
          ))}
        </div>
        <div className="mb-4 text-[10px] text-muted-foreground">
          {streak.currentStreak}-day streak · Best ever: {streak.bestStreak}{' '}
          days
        </div>

        {/* Activity feed */}
        <div className="mb-2 text-[11px] font-bold text-foreground/80">
          Recent Activity
        </div>
        <div className="flex flex-col">
          {(Array.isArray(activity) ? activity : []).slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 border-b border-border/50 py-2.5 last:border-b-0"
            >
              <div
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  activityDotColor[item.type] ?? 'bg-muted-foreground'
                )}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="text-xs text-foreground/80"
                  dangerouslySetInnerHTML={{ __html: item.message }}
                />
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {timeAgo(item.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
