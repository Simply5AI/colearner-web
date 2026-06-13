import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherOrgSetupLoading() {
  return (
    <>
      <div className="border-b border-border/60 bg-card/95 px-5 py-4 md:px-7">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <div className="p-5 md:p-7">
        <Skeleton className="mx-auto h-80 max-w-xl rounded-xl" />
      </div>
    </>
  )
}