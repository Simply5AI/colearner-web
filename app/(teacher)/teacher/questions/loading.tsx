import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherQuestionsLoading() {
  return (
    <>
      <div className="border-b border-border/60 bg-card/95 px-5 py-4 md:px-7">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="space-y-5 p-5 md:p-7">
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </>
  )
}
