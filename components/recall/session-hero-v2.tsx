'use client'

import type { ConceptMastery } from '@/lib/types'

interface SessionHeroV2Props {
  concepts: ConceptMastery[]
  extractionTitle: string
  sessionCount?: number
}

export function SessionHeroV2({ concepts, extractionTitle, sessionCount }: SessionHeroV2Props) {
  const expertCount = concepts.filter((c) => c.masteryLevel === 'expert').length
  const learningCount = concepts.filter((c) => c.masteryLevel === 'intermediate' || c.masteryLevel === 'needs_work').length
  const notStartedCount = concepts.filter((c) => c.masteryLevel === 'beginner').length

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1C1410] to-[#261A10] p-8 text-white">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full border border-white/[0.06]" />
      <div className="pointer-events-none absolute bottom-[-30px] right-10 h-36 w-36 rounded-full border border-white/[0.04]" />

      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            Practice <span className="text-amber-500">Concepts</span>
          </h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/40">
            {concepts.length} concepts from{' '}
            <span className="font-medium text-white/60">{extractionTitle}</span>.
            Select concepts, pick your difficulty, and start practicing.
          </p>
        </div>

        <div className="flex gap-6">
          <StatBlock value={expertCount} label="Mastered" color="text-emerald-400" />
          <StatBlock value={learningCount} label="Learning" color="text-blue-400" />
          <StatBlock value={notStartedCount} label="Not Started" color="text-white/40" />
          <StatBlock value={sessionCount ?? 0} label="Sessions" color="text-amber-500" />
        </div>
      </div>
    </div>
  )
}

function StatBlock({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono text-3xl font-extrabold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </div>
    </div>
  )
}
