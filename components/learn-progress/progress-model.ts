import { CheckCircle2, Circle, CircleHelp, Flower2, Leaf, LeafyGreen, Sparkles, Sprout, type LucideIcon } from 'lucide-react'
import type { MasteryState } from '@/lib/api/learn-progress'

export const REWARDS_LATER = 'Levels and badges arrive in a later release'

export interface MasteryFace { label: string; stage: string; icon: LucideIcon; className: string }

/** Colour, icon and words for every mastery state. Kids use the plant stage and never a number. */
export const masteryFace: Record<MasteryState, MasteryFace> = {
  NOT_STARTED: { label: 'Not started', stage: 'Seed', icon: Circle, className: 'ds-mastery-new' },
  LEARNING: { label: 'Learning', stage: 'Sprout', icon: Sprout, className: 'ds-mastery-learning' },
  PRACTICING: { label: 'Practising', stage: 'Leaves', icon: Leaf, className: 'ds-mastery-review' },
  SECURE: { label: 'Secure', stage: 'More leaves', icon: LeafyGreen, className: 'ds-mastery-mastered' },
  MASTERED: { label: 'Mastered', stage: 'Bloom', icon: Flower2, className: 'ds-mastery-excel' },
}

export const masteryIcon: Record<MasteryState, LucideIcon> = {
  NOT_STARTED: Circle,
  LEARNING: CircleHelp,
  PRACTICING: Leaf,
  SECURE: CheckCircle2,
  MASTERED: Sparkles,
}
