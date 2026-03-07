import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Session History',
}

export default function HistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Session History</h1>
      <p className="mt-2 text-muted-foreground">
        Your past recall sessions and results.
      </p>
      {/* TODO: Session history list */}
    </div>
  )
}
