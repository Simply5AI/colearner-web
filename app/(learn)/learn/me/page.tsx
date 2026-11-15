import { MeArea } from '@/components/tutor-loop/me/me-area'
import { ME_SECTIONS, type MeSectionId } from '@/components/tutor-loop/me/me-sections'

export const metadata = { title: 'Me | CoLearner' }

export default async function MePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams
  const initial = ME_SECTIONS.find((item) => item.id === section)?.id as MeSectionId | undefined
  return <MeArea initialSection={initial} />
}
