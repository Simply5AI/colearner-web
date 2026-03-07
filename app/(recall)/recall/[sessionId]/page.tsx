import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recall Session',
}

export default function RecallSessionPage({
  params: _params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Recall Session</h1>
      <p className="mt-2 text-muted-foreground">
        Active recall session will appear here.
      </p>
      {/* TODO: RecallSession component with WebSocket */}
    </div>
  )
}
