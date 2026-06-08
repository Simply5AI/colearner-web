import { Skeleton } from '@/components/ui/skeleton'

export default function AdminLearningLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(240px,1fr)_130px_auto_auto]">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
