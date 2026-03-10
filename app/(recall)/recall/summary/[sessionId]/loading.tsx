import { Skeleton } from '@/components/ui/skeleton'

export default function SummaryLoading() {
  return (
    <div className="space-y-6">
      {/* Celebration hero skeleton */}
      <div className="flex flex-col items-center py-6">
        <Skeleton className="h-[120px] w-[120px] rounded-full mb-4" />
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Question breakdown table skeleton */}
      <Skeleton className="h-64 rounded-xl" />

      {/* Next actions grid skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  )
}
