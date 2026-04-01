'use client'

import { useGamificationEvents } from '@/hooks/use-gamification-events'

export function GlobalGamificationEvents() {
  useGamificationEvents()
  return null
}
