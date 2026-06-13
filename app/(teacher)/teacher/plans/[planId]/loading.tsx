import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherPlanEditorLoading() {
  return (
    <>
      <div className="border-b border-border/60 bg-card/95 px-5 py-4 md:px-7">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="space-y-5 p-5 md:p-7">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </>
  )
}