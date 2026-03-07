import { Badge } from '@/components/ui/badge'
import type { MasteryState } from '@/lib/types'

interface MasteryBadgeProps {
  state: MasteryState
}

const stateConfig: Record<MasteryState, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-mastery-new text-white' },
  learning: { label: 'Learning', className: 'bg-mastery-learning text-white' },
  review: { label: 'Review', className: 'bg-mastery-review text-white' },
  mastered: { label: 'Mastered', className: 'bg-mastery-mastered text-white' },
  excel: { label: 'Excel', className: 'bg-mastery-excel text-white' },
}

/** Displays mastery state as a colored badge */
export function MasteryBadge({ state }: MasteryBadgeProps) {
  const config = stateConfig[state]
  return <Badge className={config.className}>{config.label}</Badge>
}
