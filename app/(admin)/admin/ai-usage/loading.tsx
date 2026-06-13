import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminAiUsageLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="my-0">
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="my-5">
        <CardContent className="p-4">
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}