import Link from 'next/link'
import { ArrowRight, BookOpen, Brain, CheckCircle2, Compass, Layers3, PlayCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { DashboardStats, RecallQueueItem, Roadmap } from '@/lib/types'

interface LearningPathCardProps {
  roadmaps: Roadmap[]
  queue: RecallQueueItem[]
  stats: DashboardStats
}

function getRoadmapProgress(roadmap: Roadmap) {
  const totalItems = roadmap.phases.reduce((sum, phase) => sum + phase.items.length, 0)
  const capturedItems = roadmap.phases.reduce(
    (sum, phase) => sum + phase.items.filter((item) => item.status === 'CAPTURED').length,
    0
  )

  return {
    capturedItems,
    pct: totalItems > 0 ? Math.round((capturedItems / totalItems) * 100) : 0,
    totalItems,
  }
}

export function LearningPathCard({ roadmaps, queue, stats }: LearningPathCardProps) {
  const activeRoadmaps = roadmaps.filter((roadmap) => roadmap.status !== 'ARCHIVED')
  const primaryRoadmap = activeRoadmaps
    .map((roadmap) => ({ roadmap, progress: getRoadmapProgress(roadmap) }))
    .sort((a, b) => b.progress.pct - a.progress.pct)[0]

  const weakItems = queue.filter((item) => item.source === 'weak').length
  const dueQuestions = queue.reduce((sum, item) => sum + item.dueCount, 0)
  const nextQueueItem = queue.find((item) => item.source === 'weak') ?? queue[0]
  const nextHref = nextQueueItem?.extractionId ? `/recall/start/${nextQueueItem.extractionId}` : '/practice?tab=queue'

  const steps = [
    {
      title: 'Capture',
      detail: primaryRoadmap
        ? `${primaryRoadmap.progress.capturedItems}/${primaryRoadmap.progress.totalItems} plan items captured`
        : 'Create a plan to organize your sources',
      icon: BookOpen,
      href: primaryRoadmap ? `/roadmaps/${primaryRoadmap.roadmap.id}` : '/roadmaps',
      active: Boolean(primaryRoadmap),
    },
    {
      title: 'Practice',
      detail: dueQuestions > 0 ? `${dueQuestions} questions ready today` : 'No due questions yet',
      icon: PlayCircle,
      href: nextHref,
      active: dueQuestions > 0,
    },
    {
      title: 'Review',
      detail: weakItems > 0 ? `${weakItems} weak topic${weakItems === 1 ? '' : 's'} to revisit` : `${stats.passRate}% success rate`,
      icon: Brain,
      href: '/progress',
      active: weakItems > 0 || stats.totalRecalls > 0,
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Compass className="h-4 w-4 text-primary" />
            Today&apos;s Learning Path
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow a simple loop: capture the right source, practice recall, then review weak spots.
          </p>
        </div>
        <Link
          href={nextQueueItem ? nextHref : '/roadmaps'}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary/90"
        >
          {nextQueueItem ? 'Start next session' : 'Set up path'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {primaryRoadmap && (
        <div className="mt-4 rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Layers3 className="h-4 w-4 shrink-0 text-primary" />
              <span className="line-clamp-1 text-xs font-bold text-foreground">
                {primaryRoadmap.roadmap.title}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-primary">
              {primaryRoadmap.progress.pct}%
            </span>
          </div>
          <Progress value={primaryRoadmap.progress.pct} className="h-2" />
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <Link
            key={step.title}
            href={step.href}
            className={cn(
              'group rounded-lg border p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]',
              step.active ? 'border-border bg-background' : 'border-border/70 bg-muted/20'
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </div>
              <CheckCircle2
                className={cn(
                  'h-4 w-4',
                  step.active ? 'text-green-600' : 'text-muted-foreground/35'
                )}
              />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Step {index + 1}
            </div>
            <div className="mt-1 text-sm font-bold text-foreground">{step.title}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
