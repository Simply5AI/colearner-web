import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminAiUsageEventsLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-5 h-4 w-80" />
      <Card className="mb-4">
        <CardContent className="grid gap-2 p-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}