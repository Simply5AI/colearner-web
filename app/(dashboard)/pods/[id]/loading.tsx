import { Skeleton } from '@/components/ui/skeleton'

export default function PodDetailLoading() {
  return (
    <div className="p-7 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
