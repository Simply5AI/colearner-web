import type { Metadata } from 'next'
import { SuggestionsLoading } from '@/components/onboarding/suggestions-loading'

export const metadata: Metadata = {
  title: 'Generating Your Learning Plan',
}

export default function AISuggestionsPage() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 sm:px-6 sm:py-8">
      <SuggestionsLoading />
    </div>
  )
}
