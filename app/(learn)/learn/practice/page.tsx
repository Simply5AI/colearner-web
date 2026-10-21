import type { Metadata } from 'next'
import { HubScreen } from '@/components/practice/hub-screen'

export const metadata: Metadata = { title: 'Practice | CoLearner' }
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

/** L9. The hub, due reviews and past sessions. The tab and plan filter come from the address; the server owns every check. */
export default async function PracticeHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  return <HubScreen initialTab={one(query.tab) === 'past' ? 'past' : 'today'} planId={one(query.planId)} />
}
