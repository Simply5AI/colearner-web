import type { Metadata } from 'next'
import { TopBar } from '@/components/shared/TopBar'
import { RecallPageClient } from '@/components/recall/recall-page-client'

export const metadata: Metadata = {
  title: 'Recall',
}

export default function RecallPage() {
  return (
    <>
      <TopBar title="Recall" subtitle="Choose a source to start your recall session" />
      <RecallPageClient />
    </>
  )
}
