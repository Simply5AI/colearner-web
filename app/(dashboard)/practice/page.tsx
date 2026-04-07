import type { Metadata } from 'next'
import { TopBar } from '@/components/shared/TopBar'
import { PracticePageClient } from '@/components/practice/practice-page-client'

export const metadata: Metadata = {
  title: 'Practice',
}

export default function PracticePage() {
  return (
    <>
      <TopBar title="Practice" subtitle="Choose a source or review due concepts" />
      <PracticePageClient />
    </>
  )
}
