import type { Metadata } from 'next'
import { StartScreen } from '@/components/practice/start-screen'

export const metadata: Metadata = { title: 'Start practice | CoLearner' }
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

/** The ids are validated by the client screen and again by the server, which owns the material, learner and school checks. */
export default async function StartPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  return <StartScreen scope={one(query.scope)} id={one(query.id)} planId={one(query.planId)} />
}
