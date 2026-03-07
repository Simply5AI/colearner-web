import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Extract',
}

export default function ExtractPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Video Extraction</h1>
      <p className="mt-2 text-muted-foreground">
        Extract concepts and questions from video content.
      </p>
      {/* TODO: VideoExtractor component */}
    </div>
  )
}
