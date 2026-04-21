import type { DashboardStats } from '@/lib/types'

interface GreetingBannerProps {
  userName: string
  stats: DashboardStats
  planCount: number
  sourceCount: number
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function GreetingBanner({ userName, stats, planCount, sourceCount }: GreetingBannerProps) {
  const firstName = userName.split(' ')[0]
  const greeting = getGreeting()

  let subtitle: string
  if (planCount === 0) {
    subtitle = 'Create a study plan to start capturing and practicing.'
  } else if (sourceCount === 0) {
    subtitle = `${planCount} study plan${planCount === 1 ? '' : 's'} ready. Capture a source to start practicing.`
  } else {
    subtitle = `${sourceCount} source${sourceCount === 1 ? '' : 's'} ready to practice across ${planCount} plan${planCount === 1 ? '' : 's'}.`
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C1410] to-[#261A10] px-8 py-7 text-white">
      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full border border-primary/15" />
      <div className="absolute right-5 top-5 h-[120px] w-[120px] rounded-full border border-primary/[0.08]" />

      <div className="relative z-10 flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">
            {greeting}, <span className="text-primary">{firstName}</span>
          </h2>
          <p className="text-[13px] text-white/45">{subtitle}</p>
        </div>

        <div className="flex gap-5">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-primary">
              {stats.streak}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/35">
              Day Streak
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-primary">
              {stats.passRate}%
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/35">
              Success Rate
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-primary">
              {stats.activeConcepts}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/35">
              Topics
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
