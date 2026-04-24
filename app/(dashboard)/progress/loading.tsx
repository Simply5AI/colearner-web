import { Skeleton } from '@/components/ui/skeleton'

export default function MasteryLoading() {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-7 py-4">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1.5 h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="space-y-6 p-7">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </>
  )
}
