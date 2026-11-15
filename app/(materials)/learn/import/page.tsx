import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoadingState } from '@/components/design-system'
import { MaterialImport } from '@/components/materials/material-import'
import { ImportTarget } from '@/components/tutor-loop/library/import-target'
import { tutorLoopReady } from '@/components/tutor-loop/shell/eligibility'

export const metadata: Metadata = { title: 'Import material | CoLearner' }
export default async function ImportPage() {
  const tutor = await tutorLoopReady()
  return <Suspense fallback={<LoadingState label="Loading your import…" />}>{tutor && <ImportTarget />}<MaterialImport /></Suspense>
}
