'use client'

import { Button } from '@/components/ui/button'

interface ErrorFallbackProps {
  title?: string
  message?: string
  onRetry?: () => void
}

/** Reusable error fallback UI */
export function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred.',
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-muted-foreground">{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}
