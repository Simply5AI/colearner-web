import type { Metadata } from 'next'
import { TeachEntryScreen } from '@/components/teach-back/teach-view'

export const metadata: Metadata = { title: 'Teach it back | CoLearner' }
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

/** L12 entry. The server owns access, consent and whether voice is available. */
export default async function TeachPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  return <TeachEntryScreen practiceSessionId={one(query.practiceSessionId)} materialId={one(query.materialId)} />
}
