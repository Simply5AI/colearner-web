import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoadingState } from '@/components/design-system'
import { MaterialImport } from '@/components/materials/material-import'

export const metadata: Metadata = { title: 'Import material | CoLearner' }
export default function ImportPage() { return <Suspense fallback={<LoadingState label="Loading your import…" />}><MaterialImport /></Suspense> }
