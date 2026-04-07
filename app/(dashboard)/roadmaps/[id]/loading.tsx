import { Skeleton } from '@/components/ui/skeleton'

export default function RoadmapDetailLoading() {
  return (
    <div className="p-7 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ))}
    </div>
  )
}
