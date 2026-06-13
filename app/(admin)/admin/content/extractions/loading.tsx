import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminContentExtractionsLoading() {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-5 h-4 w-64" />
      <Card className="mb-4"><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
      <Card><CardContent className="space-y-3 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
    </div>
  )
}