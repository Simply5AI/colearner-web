import { Skeleton } from '@/components/ui/skeleton'

export default function RecallSessionLoading() {
  return (
    <div className="space-y-6">
      {/* Progress bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-2 flex-1 rounded-full" />
      </div>

      {/* Question shell skeleton */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  )
}
