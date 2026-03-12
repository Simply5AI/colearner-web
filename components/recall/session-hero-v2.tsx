'use client'

import type { QueueStats } from '@/lib/types'

interface SessionHeroV2Props {
  stats: QueueStats
  extractionTitle: string
}

export function SessionHeroV2({ stats, extractionTitle }: SessionHeroV2Props) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1C1410] to-[#261A10] p-8 text-white">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full border border-white/[0.06]" />
      <div className="pointer-events-none absolute bottom-[-30px] right-10 h-36 w-36 rounded-full border border-white/[0.04]" />

      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            Ready to <span className="text-amber-500">Recall</span>?
          </h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/40">
            You have {stats.dueCount} items due and {stats.failedCount} failed items from{' '}
            <span className="font-medium text-white/60">{extractionTitle}</span>.
            Select your configuration and begin.
          </p>
        </div>

        <div className="flex gap-6">
          <StatBlock value={stats.dueCount} label="Due Today" />
          <StatBlock value={stats.failedCount} label="Failed" />
          <StatBlock value={`${stats.passRate}%`} label="Pass Rate" />
        </div>
      </div>
    </div>
  )
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-3xl font-extrabold text-amber-500">{value}</div>
      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </div>
    </div>
  )
}
