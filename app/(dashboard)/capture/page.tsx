import type { Metadata } from 'next'
import { TopBar } from '@/components/shared/TopBar'
import { CapturePageClient } from '@/components/capture/capture-page-client'

export const metadata: Metadata = {
  title: 'Capture',
}

export default function CapturePage() {
  return (
    <>
      <TopBar
        title="Capture Knowledge"
        subtitle="Choose a source to extract concepts from. We'll generate recall questions automatically."
      />
      <CapturePageClient />
    </>
  )
}
