'use client'

import { Button } from '@/components/ui/button'

export default function AdminLearningError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="px-4 py-8 md:px-6 lg:px-8">
      <div className="rounded-xl border border-destructive/30 bg-card p-6">
        <h2 className="text-lg font-bold">Failed to load learning data</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
