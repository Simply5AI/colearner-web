import { cn } from '@/lib/utils'

interface BrandMarkProps { compact?: boolean; className?: string }

export const BrandMark = ({ compact = false, className }: BrandMarkProps) => (
  <span className={cn('ds-brand', className)} aria-label="CoLearner">
    Co<span className="text-primary">{compact ? '' : 'Learner'}</span>
  </span>
)
