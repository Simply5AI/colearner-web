import type { Metadata } from 'next'
import { RoadmapsPageClient } from '@/components/roadmap/roadmaps-page-client'

export const metadata: Metadata = {
  title: 'Study Plans | CoLearner',
  description: 'AI-generated study plans and learning paths',
}

export default function RoadmapsPage() {
  return (
    <div className="p-7">
      <RoadmapsPageClient />
    </div>
  )
}
