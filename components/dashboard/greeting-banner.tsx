import type { DashboardStats } from '@/lib/types'
import type { RecallQueueItem } from '@/lib/types'
import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Flame, Target, Trophy } from 'lucide-react'

interface GreetingBannerProps {
  userName: string
  stats: DashboardStats
  planCount: number
  sourceCount: number
  nextItem?: RecallQueueItem | null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function GreetingBanner({
  userName,
  stats,
  planCount,
  sourceCount,
  nextItem,
}: GreetingBannerProps) {
  const firstName = userName.split(' ')[0]
  const greeting = getGreeting()
  const primaryHref = nextItem?.extractionId
    ? `/recall/start/${nextItem.extractionId}`
    : sourceCount > 0
      ? '/practice?tab=queue'
      : planCount > 0
        ? '/capture'
        : '/roadmaps'
  const primaryLabel = nextItem ? 'Continue practice' : sourceCount > 0 ? 'Open practice queue' : planCount > 0 ? 'Capture a source' : 'Create a study plan'

  let subtitle: string
  if (planCount === 0) {
    subtitle = 'Create a study plan to start capturing and practicing.'
  } else if (sourceCount === 0) {
    subtitle = `${planCount} study plan${planCount === 1 ? '' : 's'} ready. Capture a source to start practicing.`
  } else {
    subtitle = `${sourceCount} source${sourceCount === 1 ? '' : 's'} ready to practice across ${planCount} plan${planCount === 1 ? '' : 's'}.`
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1f1712] px-5 py-5 text-white shadow-sm md:px-7 md:py-6">
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_75%_50%,rgba(196,98,26,0.28),transparent_36%),linear-gradient(135deg,transparent,rgba(26,112,112,0.18))] lg:block" />

      <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight md:text-2xl">
            {greeting}, <span className="text-primary">{firstName}</span>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/60">{subtitle}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Recommended now
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-bold">
                  {nextItem?.conceptTitle ?? (sourceCount > 0 ? 'Practice your ready sources' : 'Build your first learning loop')}
                </p>
                <p className="mt-0.5 text-xs text-white/50">
                  {nextItem
                    ? `${nextItem.dueCount} question${nextItem.dueCount === 1 ? '' : 's'} ready for recall`
                    : sourceCount > 0
                      ? 'Start with a short recall session to create momentum.'
                      : 'Plan, capture, practice, then review your weak spots.'}
                </p>
              </div>
              <Link
                href={primaryHref}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary/90"
              >
                {primaryLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Day streak', value: stats.streak, icon: Flame },
            { label: 'Success rate', value: `${stats.passRate}%`, icon: Trophy },
            { label: 'Active topics', value: stats.activeConcepts, icon: Target },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-center">
              <item.icon className="mx-auto mb-2 h-4 w-4 text-primary" />
              <div className="font-mono text-2xl font-bold text-white">
                {item.value}
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                {item.label}
              </div>
            </div>
          ))}
          <div className="col-span-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Your home base is tuned for one focused study step at a time.
          </div>
        </div>
      </div>
    </div>
  )
}
