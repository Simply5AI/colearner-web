import type { Metadata } from 'next'
import { CreatePodForm } from '@/components/pod/create-pod-form'

export const metadata: Metadata = {
  title: 'Create Study Group | CoLearner',
}

export default function CreatePodPage() {
  return (
    <div className="p-7">
      <div className="sticky top-0 z-10 -mx-7 -mt-7 bg-background/80 backdrop-blur-sm px-7 pt-7 pb-4 border-b mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Create a Study Group</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start a study group and invite your peers
        </p>
      </div>
      <CreatePodForm />
    </div>
  )
}
