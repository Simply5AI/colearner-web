'use client'
import Link from 'next/link'
import { Button, ErrorState } from '@/components/design-system'
export default function SchoolError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <ErrorState
        band="adults"
        title="School workspace unavailable"
        description="Your membership could not be verified. No school records have been displayed."
        action={
          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Try again</Button>
            <Link href="/workspaces" className="ds-button ds-button-secondary">
              Choose workspace
            </Link>
          </div>
        }
      />
    </div>
  )
}
