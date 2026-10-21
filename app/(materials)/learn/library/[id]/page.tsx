import type { Metadata } from 'next'
import { MaterialReader } from '@/components/materials/material-reader'

export const metadata: Metadata = { title: 'Read material | CoLearner' }
export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MaterialReader id={id} /> }
