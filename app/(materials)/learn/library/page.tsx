import type { Metadata } from 'next'
import { MaterialLibrary } from '@/components/materials/material-library'

export const metadata: Metadata = { title: 'Your library | CoLearner' }
export default function LibraryPage() { return <MaterialLibrary /> }
