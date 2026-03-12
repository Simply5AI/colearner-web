import { Skeleton } from '@/components/ui/skeleton'

export default function ExtractionRecallLoading() {
  return (
    <div className="space-y-6 p-7">
      {/* Hero skeleton */}
      <Skeleton className="h-40 w-full rounded-xl" />

      {/* Config panel skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="mb-5 h-5 w-48" />
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <Skeleton className="mb-5 h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Queue preview skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
