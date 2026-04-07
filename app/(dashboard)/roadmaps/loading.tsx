import { Skeleton } from '@/components/ui/skeleton'

export default function RoadmapsLoading() {
  return (
    <div className="p-7 space-y-6">
      <div className="sticky top-0 z-10 -mx-7 -mt-7 bg-background/80 backdrop-blur-sm px-7 pt-7 pb-4 border-b">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1 h-4 w-72" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  )
}
