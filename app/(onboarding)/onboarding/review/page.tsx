import type { Metadata } from 'next'
import { OnboardingHeader } from '@/components/onboarding/onboarding-header'
import { SuggestionsReview } from '@/components/onboarding/suggestions-review'

export const metadata: Metadata = {
  title: 'Review Your Learning Plan',
}

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 sm:px-6 sm:py-8">
      <OnboardingHeader
        currentStep={6}
        totalSteps={6}
        skipHref="/onboarding/welcome"
        skipLabel="Skip to dashboard"
      />

      <div className="mt-10 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Step 6 of 6
        </p>
      </div>

      <div className="mt-6">
        <SuggestionsReview />
      </div>
    </div>
  )
}
