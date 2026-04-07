import type { Metadata } from 'next'
import { RoadmapsPageClient } from '@/components/roadmap/roadmaps-page-client'

export const metadata: Metadata = {
  title: 'Study Plans | CoLearner',
  description: 'AI-generated study plans and learning paths',
}

export default function RoadmapsPage() {
  return (
    <div className="p-7">
      <div className="sticky top-0 z-10 -mx-7 -mt-7 bg-background/80 backdrop-blur-sm px-7 pt-7 pb-4 border-b mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Study Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated learning paths, syllabus imports, and exam prep plans
        </p>
      </div>
      <RoadmapsPageClient />
    </div>
  )
}
