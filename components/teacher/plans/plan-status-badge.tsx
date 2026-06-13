import { Badge } from '@/components/ui/badge'
import type { PlanStatus } from '@/lib/types/teacher'

const statusVariant: Record<PlanStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  PUBLISHED: 'default',
  ARCHIVED: 'secondary',
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return (
    <Badge variant={statusVariant[status]} className="capitalize">
      {status.toLowerCase()}
    </Badge>
  )
}