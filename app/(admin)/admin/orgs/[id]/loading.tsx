import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminOrgDetailLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <Skeleton className="mb-4 h-7 w-36" />
      <div className="mb-6 flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
