import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherOnboardingLoading() {
  return (
    <>
      <div className="border-b border-border/60 bg-card/95 px-5 py-4 md:px-7">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3 w-80" />
      </div>
      <div className="p-5 md:p-7">
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </>
  )
}