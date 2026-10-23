import { cn } from '@/lib/utils'

interface BrandMarkProps { compact?: boolean; className?: string }

export const BrandMark = ({ compact = false, className }: BrandMarkProps) => (
  <span className={cn('ds-brand', className)} aria-label="CoLearner">
    <img className="ds-brand-mark" src="/co.svg" alt="" width={36} height={36} />
    <span>Co<span className="text-primary">{compact ? '' : 'Learner'}</span></span>
  </span>
)
