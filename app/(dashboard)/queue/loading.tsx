import { Skeleton } from '@/components/ui/skeleton'

export default function QueueLoading() {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-7 py-4">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1.5 h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="space-y-4 p-7">
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </>
  )
}
