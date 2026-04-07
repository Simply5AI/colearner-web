import type { Metadata } from 'next'
import { PodsPageClient } from '@/components/pod/pods-page-client'

export const metadata: Metadata = {
  title: 'Study Groups | CoLearner',
  description: 'Join or create study groups to learn together with peers',
}

export default function PodsPage() {
  return (
    <div className="p-7">
      <div className="sticky top-0 z-10 -mx-7 -mt-7 bg-background/80 backdrop-blur-sm px-7 pt-7 pb-4 border-b mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Study Groups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Learn together, compete on leaderboards, and stay accountable
        </p>
      </div>
      <PodsPageClient />
    </div>
  )
}
