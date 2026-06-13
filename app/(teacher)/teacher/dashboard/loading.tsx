import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherDashboardLoading() {
  return (
    <>
      <div className="border-b border-border/60 bg-card/95 px-5 py-4 md:px-7">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-3 w-32" />
      </div>
      <div className="space-y-5 p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  )
}