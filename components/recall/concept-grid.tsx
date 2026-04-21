'use client'

import { CheckCircle2, Circle, Award, TrendingUp, AlertTriangle, Compass } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { ConceptMastery } from '@/lib/types'

const MASTERY_CONFIG = {
  expert: {
    label: 'Expert',
    icon: Award,
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  intermediate: {
    label: 'Intermediate',
    icon: TrendingUp,
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  needs_work: {
    label: 'Needs Work',
    icon: AlertTriangle,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  beginner: {
    label: 'Not Started',
    icon: Compass,
    badgeClass: 'border-border bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground/40',
  },
} as const

interface ConceptGridProps {
  concepts: ConceptMastery[]
  selectedIds: Set<string>
  onToggle: (conceptId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function ConceptGrid({ concepts, selectedIds, onToggle, onSelectAll, onDeselectAll }: ConceptGridProps) {
  const allSelected = concepts.length > 0 && selectedIds.size === concepts.length

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-extrabold text-foreground">
          Concepts
          <span className="rounded-full bg-brand-orange/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-orange">
            {concepts.length} total
          </span>
        </div>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-xs font-medium text-brand-orange hover:underline"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {concepts.map((concept) => (
          <ConceptCard
            key={concept.conceptId}
            concept={concept}
            selected={selectedIds.has(concept.conceptId)}
            onToggle={() => onToggle(concept.conceptId)}
          />
        ))}
      </div>
    </div>
  )
}

function ConceptCard({
  concept,
  selected,
  onToggle,
}: {
  concept: ConceptMastery
  selected: boolean
  onToggle: () => void
}) {
  const config = MASTERY_CONFIG[concept.masteryLevel]
  const Icon = config.icon

  return (
    <div
      onClick={onToggle}
      className={`cursor-pointer rounded-xl border-[1.5px] p-4 transition-all duration-150 ${
        selected
          ? 'border-brand-orange bg-brand-orange/[0.03] shadow-sm'
          : 'border-border bg-card hover:border-muted-foreground/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle()}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">
              {concept.title}
            </h4>
          </div>
          {concept.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {concept.description}
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
              <Icon className="mr-1 h-2.5 w-2.5" />
              {config.label}
            </Badge>
            {concept.questionsAnswered > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {concept.questionsAnswered} answered
              </span>
            )}
          </div>
        </div>
        {selected && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-orange" />
        )}
      </div>
    </div>
  )
}
