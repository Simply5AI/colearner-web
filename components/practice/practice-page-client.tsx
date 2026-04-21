'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { SourceTab } from '@/components/practice/source-tab'

function PracticePageInner() {
  return (
    <div className="p-7">
      <SourceTab />
    </div>
  )
}

export function PracticePageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      }
    >
      <PracticePageInner />
    </Suspense>
  )
}
