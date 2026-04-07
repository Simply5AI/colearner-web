import type { Metadata } from 'next'
import { PodDetailClient } from '@/components/pod/pod-detail-client'

export const metadata: Metadata = {
  title: 'Study Group | CoLearner',
}

interface PodPageProps {
  params: Promise<{ id: string }>
}

export default async function PodPage({ params }: PodPageProps) {
  const { id } = await params

  return (
    <div className="p-7">
      <PodDetailClient podId={id} />
    </div>
  )
}
