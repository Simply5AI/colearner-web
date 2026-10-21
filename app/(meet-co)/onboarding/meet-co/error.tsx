'use client'
import { Button, ErrorState } from '@/components/design-system'

export default function MeetCoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl p-6">
      <ErrorState title="Setup is unavailable" description="We could not check your access. Nothing was changed. Please try again." action={<Button onClick={reset}>Try again</Button>} />
    </main>
  )
}
