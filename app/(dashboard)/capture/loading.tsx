import { Skeleton } from '@/components/ui/skeleton'

export default function CaptureLoading() {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-7 py-4">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
      </div>
      <div className="space-y-6 p-7">
        <Skeleton className="h-14 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </>
  )
}
