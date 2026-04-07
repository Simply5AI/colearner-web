import { Skeleton } from '@/components/ui/skeleton'

export default function PodsLoading() {
  return (
    <div className="p-7 space-y-6">
      <div className="sticky top-0 z-10 -mx-7 -mt-7 bg-background/80 backdrop-blur-sm px-7 pt-7 pb-4 border-b">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1 h-4 w-72" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
