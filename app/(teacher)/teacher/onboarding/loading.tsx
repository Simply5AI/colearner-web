import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherOnboardingLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-72" />
    </div>
  )
}