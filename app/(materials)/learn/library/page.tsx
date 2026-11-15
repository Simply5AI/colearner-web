import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MaterialLibrary } from '@/components/materials/material-library'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Your library | CoLearner' }
export default async function LibraryPage() {
  if (await tutorLoopReady()) redirect('/learn?tab=library')
  return <MaterialLibrary />
}
