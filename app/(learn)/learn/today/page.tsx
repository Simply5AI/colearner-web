import type { Metadata } from 'next'
import { TodayArea, type TodayTabId } from '@/components/tutor-loop/today/today-area'

// A client module's exports cannot be called from a server component, so the tab check lives here.
const TABS: readonly TodayTabId[] = ['today', 'week', 'progress']
const asTab = (value: string | undefined): TodayTabId => (TABS.find((t) => t === value) ?? 'today')

export const metadata: Metadata = { title: 'Today | CoLearner' }

export default async function LearnTodayPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <TodayArea initialTab={asTab(tab)} />
}
