'use client'

import { Button } from '@/components/ui/button'

export default function EnrolledPlansError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-7 text-center">
      <h2 className="text-lg font-semibold">Could not load enrolled plans</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || 'Something went wrong while loading your teacher study plans.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}