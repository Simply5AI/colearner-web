'use client'

import { Loader2 } from 'lucide-react'

export function JudgingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-brand-teal mb-3" />
      <p className="text-sm font-medium text-muted-foreground">
        Judging your answer...
      </p>
    </div>
  )
}
