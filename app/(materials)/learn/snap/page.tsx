import type { Metadata } from 'next'
import { MaterialSnap } from '@/components/materials/material-snap'

export const metadata: Metadata = { title: 'Snap a page | CoLearner' }
export default function SnapPage() { return <MaterialSnap /> }
