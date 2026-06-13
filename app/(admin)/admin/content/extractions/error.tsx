'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminContentExtractionsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <Card className="my-0 max-w-2xl">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">Extractions failed to load</h1>
            <p className="mt-1 text-sm text-muted-foreground">{error.message || 'Unexpected error.'}</p>
            <Button className="mt-4" variant="outline" onClick={reset}><RefreshCw className="h-4 w-4" /> Retry</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}