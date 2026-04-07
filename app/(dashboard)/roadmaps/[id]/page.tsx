import type { Metadata } from 'next'
import { RoadmapDetailClient } from '@/components/roadmap/roadmap-detail-client'

export const metadata: Metadata = {
  title: 'Study Plan | CoLearner',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoadmapDetailPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="p-7">
      <RoadmapDetailClient roadmapId={id} />
    </div>
  )
}
