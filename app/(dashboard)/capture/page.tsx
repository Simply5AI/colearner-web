import type { Metadata } from 'next'
import { TopBar } from '@/components/shared/TopBar'
import { CapturePageClient } from '@/components/capture/capture-page-client'

export const metadata: Metadata = {
  title: 'Library',
}

export default function CapturePage() {
  return (
    <>
      <TopBar
        title="Library"
        subtitle="Add learning material, extract key concepts, then practice with recall when you're ready."
      />
      <CapturePageClient />
    </>
  )
}
