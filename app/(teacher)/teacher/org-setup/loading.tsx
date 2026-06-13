import { Skeleton } from '@/components/ui/skeleton'

export default function TeacherOrgSetupLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-64" />
    </div>
  )
}