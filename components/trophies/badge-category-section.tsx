import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { LockKeyhole, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Badge } from '@/lib/api/gamification'

const tierRing: Record<string, string> = {
  bronze: 'ring-amber-700/30',
  silver: 'ring-slate-400/40',
  gold: 'ring-yellow-500/40',
  platinum: 'ring-cyan-400/40',
  diamond: 'ring-indigo-500/40',
}

function BadgeTile({ badge }: { badge: Badge }) {
  const earned = badge.isEarned
  const progressPct = badge.progress
    ? Math.min(100, Math.round((badge.progress.current / badge.progress.threshold) * 100))
    : 0

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all',
        earned
          ? `bg-card ring-2 ${tierRing[badge.tier] ?? 'ring-primary/30'} hover:-translate-y-0.5 hover:shadow-md`
          : 'bg-muted/20 opacity-80'
      )}
    >
      <CardHeader className="items-center pb-2 text-center">
        <div
          className={cn(
            'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-border/40 bg-background/80 text-2xl',
            !earned && 'grayscale'
          )}
        >
          {earned ? badge.icon || <Trophy className="h-6 w-6 text-primary" /> : <LockKeyhole className="h-5 w-5 opacity-40" />}
        </div>
        <CardTitle className="text-sm">{badge.name}</CardTitle>
        <CardDescription className="text-[10px] uppercase tracking-wider">
          {badge.tier}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-center">
        <p className="text-xs text-muted-foreground">{badge.description}</p>
        {!earned && badge.progress && (
          <div className="space-y-1">
            <Progress value={progressPct} className="h-1.5" />
            <div className="text-[10px] font-semibold text-muted-foreground">
              {badge.progress.current} / {badge.progress.threshold}
            </div>
          </div>
        )}
        {earned && badge.earnedAt && (
          <p className="text-[10px] text-muted-foreground">
            Earned {new Date(badge.earnedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface BadgeCategorySectionProps {
  title: string
  description: string
  icon: React.ReactNode
  badges: Badge[]
  emptyState?: React.ReactNode
}

export function BadgeCategorySection({
  title,
  description,
  icon,
  badges,
  emptyState,
}: BadgeCategorySectionProps) {
  const earned = badges.filter((b) => b.isEarned)
  const pct = badges.length > 0 ? Math.round((earned.length / badges.length) * 100) : 0

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="min-w-[140px]">
          <div className="mb-1 text-right text-[11px] font-semibold text-muted-foreground">
            {earned.length} / {badges.length} earned
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      </div>

      {badges.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {badges.map((b) => (
            <BadgeTile key={b.id} badge={b} />
          ))}
        </div>
      ) : null}

      {emptyState}
    </section>
  )
}
