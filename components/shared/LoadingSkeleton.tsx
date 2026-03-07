import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSkeletonProps {
  lines?: number
}

/** Generic loading skeleton with configurable line count */
export function LoadingSkeleton({ lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" style={{ width: `${100 - i * 10}%` }} />
      ))}
    </div>
  )
}
