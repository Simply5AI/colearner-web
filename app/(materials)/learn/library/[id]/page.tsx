import type { Metadata } from 'next'
import { MaterialReader } from '@/components/materials/material-reader'
import { TutorReader } from '@/components/tutor-loop/library/tutor-reader'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Read material | CoLearner' }
export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (await tutorLoopReady()) ? <TutorReader id={id} /> : <MaterialReader id={id} />
}
