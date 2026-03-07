'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <h2 className="text-xl font-bold">Failed to load dashboard</h2>
      <p className="text-muted-foreground">Please try again.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  )
}
