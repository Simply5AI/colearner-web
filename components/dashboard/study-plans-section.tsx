import Link from 'next/link'
import { ArrowRight, BookOpenCheck, CheckCircle2, GraduationCap, Layers3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Roadmap, RoadmapStatus } from '@/lib/types'

interface StudyPlansSectionProps {
  roadmaps: Roadmap[]
}

const statusVariant: Record<RoadmapStatus, 'default' | 'secondary' | 'outline'> = {
  GENERATING: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ARCHIVED: 'outline',
}

function progressForRoadmap(roadmap: Roadmap) {
  const totalItems = roadmap.phases.reduce((sum, phase) => sum + phase.items.length, 0)
  const capturedItems = roadmap.phases.reduce(
    (sum, phase) => sum + phase.items.filter((item) => item.status === 'CAPTURED').length,
    0
  )
  const nextItem = roadmap.phases
    .flatMap((phase) => phase.items.map((item) => ({ ...item, phaseTitle: phase.title })))
    .find((item) => item.status !== 'CAPTURED' && item.status !== 'SKIPPED')

  return {
    capturedItems,
    nextItem,
    pct: totalItems > 0 ? Math.round((capturedItems / totalItems) * 100) : 0,
    totalItems,
  }
}

export function StudyPlansSection({ roadmaps }: StudyPlansSectionProps) {
  const visible = roadmaps
    .filter((roadmap) => roadmap.status !== 'ARCHIVED')
    .slice(0, 3)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" />
          Active Study Plans
        </h2>
        <Link
          href="/roadmaps"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((roadmap) => {
          const { totalItems, capturedItems, pct, nextItem } = progressForRoadmap(roadmap)
          const isStarted = pct > 0

          return (
            <div
              key={roadmap.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/roadmaps/${roadmap.id}`}
                    className="line-clamp-2 text-sm font-bold leading-5 text-foreground hover:text-primary"
                  >
                    {roadmap.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={statusVariant[roadmap.status]}
                      className="h-5 shrink-0 text-[10px]"
                    >
                      {roadmap.status === 'GENERATING'
                        ? 'Generating'
                        : roadmap.status.charAt(0) + roadmap.status.slice(1).toLowerCase()}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {roadmap.totalPhases} phase{roadmap.totalPhases === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold',
                    isStarted
                      ? 'border-primary/25 bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground'
                  )}
                >
                  {pct}%
                </div>
              </div>

              <Progress value={pct} className="h-2" />

              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{capturedItems} / {totalItems} items captured</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  {totalItems - capturedItems} left
                </span>
              </div>

              <div className="mt-4 rounded-lg bg-muted/35 p-3">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <Layers3 className="h-3.5 w-3.5" />
                  Next plan item
                </div>
                <p className="line-clamp-1 text-xs font-semibold text-foreground">
                  {nextItem?.title ?? 'All planned items are captured'}
                </p>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {nextItem?.phaseTitle ?? 'Move into practice and review.'}
                </p>
              </div>

              <Link
                href={`/roadmaps/${roadmap.id}`}
                className="mt-4 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary"
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                Open plan
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
