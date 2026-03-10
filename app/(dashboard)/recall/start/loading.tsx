import { Skeleton } from '@/components/ui/skeleton'

export default function RecallStartLoading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-7 py-4">
        <Skeleton className="h-5 w-20" />
      </div>

      <div className="space-y-6 p-7">
        {/* Hero skeleton */}
        <div className="rounded-xl border bg-card p-6 text-center">
          <Skeleton className="mx-auto h-7 w-48 mb-3" />
          <Skeleton className="mx-auto h-4 w-64 mb-5" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>

        {/* Question count selector skeleton */}
        <Skeleton className="h-40 rounded-xl" />

        {/* Queue preview skeleton */}
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </>
  )
}
