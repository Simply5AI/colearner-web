import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-7 py-4">
        <div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1.5 h-3 w-44" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-[34px] w-32 rounded-lg" />
          <Skeleton className="h-[34px] w-[34px] rounded-lg" />
          <Skeleton className="h-[34px] w-[34px] rounded-lg" />
        </div>
      </div>

      <div className="space-y-6 p-7">
        {/* Greeting banner */}
        <Skeleton className="h-28 rounded-2xl" />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>

        {/* Nudge */}
        <Skeleton className="h-14 rounded-xl" />

        {/* Grid cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    </>
  )
}
