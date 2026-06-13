import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminBillingSubscriptionsLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Card className="my-5">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}