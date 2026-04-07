import type { Metadata } from 'next'
import { PodDetailClient } from '@/components/pod/pod-detail-client'

export const metadata: Metadata = {
  title: 'Group Library | CoLearner',
}

interface PodCapturesPageProps {
  params: Promise<{ id: string }>
}

export default async function PodCapturesPage({ params }: PodCapturesPageProps) {
  const { id } = await params

  return (
    <div className="p-7">
      <PodDetailClient podId={id} />
    </div>
  )
}
