import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Session Summary',
}

export default function SessionSummaryPage({
  params: _params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Session Summary</h1>
      <p className="mt-2 text-muted-foreground">
        Your session results and scores will appear here.
      </p>
      {/* TODO: SessionSummary component */}
    </div>
  )
}
